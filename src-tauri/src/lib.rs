use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::io::Write;
use std::path::Path;
use std::process::Command;
use std::sync::{Mutex, OnceLock};
use tauri::command;
use tiny_keccak::Hasher;

#[command]
fn add_secrets(
    app: String,
    desc: String,
    format: String,
    secrets: String,
    push_to_cloud: String,
    answer: String,
) -> Result<(), String> {
    let email = get_gpg_email()?;
    let mut lines = get_index_lines()?;
    let mut file_number = 1;
    if !lines.is_empty() {
        let last_line = lines.last().unwrap();
        let last_file_number_str = &last_line[..3];
        file_number = last_file_number_str
            .parse::<i32>()
            .map_err(|e| e.to_string())?
            + 1;
    }
    let file_number_str = format!("{:03}", file_number);
    let new_line = format!("{}.{}.{}{}", file_number_str, app, desc, format);
    lines.push(new_line);
    let index = lines.join("\n");
    encrypt(&email, &index, "./000.gpg")?;

    encrypt_with_answer(
        &email,
        &secrets,
        &answer,
        &format!("./{}.gpg", file_number_str),
    )?;

    // 清空敏感缓存
    secrets.into_bytes().fill(0);

    // Git 提交
    let output = Command::new(get_git_cmd()?)
        .args(["add", "./"])
        .output()
        .map_err(|e| format!("Failed to execute git command: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Error result for git command: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let commit_message = format!("add: {}.gpg", file_number);
    let output = Command::new(get_git_cmd()?)
        .args(["commit", "-m", &commit_message])
        .output()
        .map_err(|e| format!("Failed to execute git command: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Error result for git command: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    // 推送到云端
    if push_to_cloud == "yes" {
        let _ = Command::new(get_git_cmd()?)
            .args(["pull", "--rebase"])
            .output();

        let mut args = vec!["push"];
        if !git_upstream_exists()? {
            args = vec!["push", "-u", "origin", "main"];
        }

        let mut child = Command::new(get_git_cmd()?)
            .args(args)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to execute git command: {}", e))?;

        if let Some(stdin) = child.stdin.as_mut() {
            let _ = stdin.write_all(b"yes\n");
        }

        let output = child
            .wait_with_output()
            .map_err(|e| format!("Failed to execute git command: {}", e))?;

        if !output.status.success() {
            return Err(format!(
                "Error result for git command: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }
    }
    Ok(())
}

#[command]
fn delete_secrets(id: String) -> Result<(), String> {
    let email = get_gpg_email()?;
    let mut lines = get_index_lines()?;
    lines.retain(|line| {
        if line.len() >= 3 {
            &line[..3] != id
        } else {
            true // 保留长度不足3的行
        }
    });

    let index = if lines.is_empty() {
        String::new()
    } else {
        lines.join("\n")
    };

    // 删除文件
    let file_path = format!("./{}.gpg", id);
    if let Err(e) = fs::remove_file(&file_path) {
        if e.kind() != std::io::ErrorKind::NotFound {
            return Err(format!("Failed to remove {}.gpg: {}", id, e));
        }
    }
    // 更新索引文件
    encrypt(&email, &index, "./000.gpg")?;

    // Git 提交
    let output = Command::new(get_git_cmd()?)
        .args(["add", "./"])
        .output()
        .map_err(|e| format!("Failed to execute git command: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Error result for git command: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let commit_message = format!("remove: {}.gpg", id);
    let output = Command::new(get_git_cmd()?)
        .args(["commit", "-m", &commit_message])
        .output()
        .map_err(|e| format!("Failed to execute git command: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Error result for git command: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    Ok(())
}

#[derive(Serialize, Deserialize, Debug)]
struct ListItem {
    id: String,
    app: String,
    desc: String,
    format: String,
}

#[command]
fn decrypt_secrets(id: String, answer: String) -> Result<String, String> {
    let file = format!("./{}.gpg", id);
    if !Path::new(&file).exists() {
        return Err(format!("File {} not found", id));
    }

    let passphrase = hash(&answer);
    let child = Command::new(get_gpg_cmd()?)
        .args([
            "--quiet",
            "--decrypt",
            "--batch",
            "--yes",
            "--passphrase",
            &passphrase,
            &file,
        ])
        .stdout(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to execute gpg command: {}", e))?;

    let output = child
        .wait_with_output()
        .map_err(|e| format!("Failed to wait for gpg command: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Error result for gpg command: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let symmetric_decrypted = &output.stdout;

    let mut child = Command::new(get_gpg_cmd()?)
        .args(["--quiet", "--decrypt"])
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to execute gpg command: {}", e))?;

    if let Some(stdin) = child.stdin.as_mut() {
        stdin
            .write_all(symmetric_decrypted)
            .map_err(|e| format!("Failed to write to gpg command: {}", e))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|e| format!("Failed to wait for gpg command: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Error result for gpg asymmetric decrypt command: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[command]
fn get_secrets_list(search_str: String) -> Result<Vec<ListItem>, String> {
    let lines = get_index_lines()?;
    let mut items: Vec<ListItem> = lines
        .iter()
        .filter(|line| line.contains(&search_str))
        .map(|line| {
            let parts: Vec<&str> = line.split('.').collect();
            let id = parts[0].to_string();
            let app = parts[1].to_string();
            let desc = parts[2].to_string();
            let format = parts[3].to_string();
            ListItem {
                id,
                app,
                desc,
                format: format!(".{}", format),
            }
        })
        .collect();

    items.reverse();
    Ok(items)
}

#[command]
fn add_email_and_question(email: String, question: String, answer: String) -> Result<(), String> {
    let output = Command::new(get_gpg_cmd()?)
        .args(["--list-key", &email])
        .output()
        .map_err(|e| format!("Failed to execute gpg command: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Error result for gpg command: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    encrypt(&email, &email, "./email.gpg")?;
    encrypt(&email, &question, "./question.gpg")?;
    encrypt(&email, &hash_twice(&answer), "./answer.gpg")?;
    Ok(())
}

#[command]
fn verify_security_question(answer: String) -> Result<bool, String> {
    let output = Command::new(get_gpg_cmd()?)
        .args(["--quiet", "--decrypt", "./answer.gpg"])
        .output()
        .map_err(|e| format!("Failed to execute gpg command: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Error result for gpg command: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    if String::from_utf8_lossy(&output.stdout) == hash_twice(&answer) {
        return Ok(true);
    }
    Ok(false)
}

#[command]
fn get_gpg_email() -> Result<String, String> {
    if !Path::new("./email.gpg").exists() {
        return Err("GPG email has not been set yet".to_string());
    }

    let output = Command::new(get_gpg_cmd()?)
        .args(["--quiet", "--decrypt", "./email.gpg"])
        .output()
        .map_err(|e| format!("Failed to execute gpg command: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Error result for gpg command: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[command]
fn get_security_question() -> Result<String, String> {
    if !Path::new("./question.gpg").exists() {
        return Err("Secret question has not been set yet".to_string());
    }

    let output = Command::new(get_gpg_cmd()?)
        .args(["--quiet", "--decrypt", "./question.gpg"])
        .output()
        .map_err(|e| format!("Failed to execute gpg command: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Error result for gpg command: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[command]
fn git_repository_exists() -> Result<bool, String> {
    let output = Command::new(get_git_cmd()?)
        .args(["remote", "-v"])
        .output()
        .map_err(|e| format!("Failed to execute git command: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Error result for git command: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    if output.stdout.is_empty() {
        return Ok(false);
    }
    Ok(true)
}

#[command]
fn is_git_available() -> Result<bool, String> {
    let path = find_git_path()?;
    if path.is_empty() {
        return Ok(false);
    }
    Ok(true)
}

#[command]
fn is_gpg_available() -> Result<bool, String> {
    let path = find_gpg_path()?;
    if path.is_empty() {
        return Ok(false);
    }
    Ok(true)
}

#[command]
fn exit_app(app_handle: tauri::AppHandle) {
    app_handle.exit(0);
}

#[command]
fn add_git_repository(repo: String) -> Result<(), String> {
    let exists = git_repository_exists()?;
    if !exists {
        let output = Command::new(get_git_cmd()?)
            .args(["remote", "add", "origin", &repo])
            .output()
            .map_err(|e| format!("Failed to execute git command: {}", e))?;
        if !output.status.success() {
            return Err(format!(
                "Error result for git command: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }
    }
    Ok(())
}

fn get_index_lines() -> Result<Vec<String>, String> {
    if !Path::new("./000.gpg").exists() {
        return Ok(vec![]);
    }

    let output = Command::new(get_gpg_cmd()?)
        .args(["--quiet", "--decrypt", "./000.gpg"])
        .output()
        .map_err(|e| format!("Failed to execute gpg command: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Error result for gpg command: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let data = String::from_utf8_lossy(&output.stdout);
    let lines: Vec<String> = data
        .split('\n')
        .filter(|s| s.len() > 0)
        .map(|s| s.to_string())
        .collect();
    Ok(lines)
}

fn encrypt(recipient: &str, message: &str, output_file: &str) -> Result<(), String> {
    if let Err(e) = fs::remove_file(output_file) {
        if e.kind() != std::io::ErrorKind::NotFound {
            return Err(format!("Error result for rm command: {}", e));
        }
    }

    let mut child = Command::new(get_gpg_cmd()?)
        .args([
            "--encrypt",
            "--recipient",
            recipient,
            "--output",
            output_file,
        ])
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to execute gpg command: {}", e))?;

    if let Some(stdin) = child.stdin.as_mut() {
        stdin
            .write_all(message.as_bytes())
            .map_err(|e| format!("Failed to write to gpg symmetric stdin: {}", e))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|e| format!("Failed to wait for gpg command: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Error result for gpg command: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    Ok(())
}

fn encrypt_with_answer(
    recipient: &str,
    message: &str,
    answer: &str,
    output_file: &str,
) -> Result<(), String> {
    if let Err(e) = fs::remove_file(output_file) {
        if e.kind() != std::io::ErrorKind::NotFound {
            return Err(format!("Error result for rm command: {}", e));
        }
    }

    let mut child = Command::new(get_gpg_cmd()?)
        .args(["--encrypt", "--recipient", recipient])
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to execute gpg command: {}", e))?;

    if let Some(stdin) = child.stdin.as_mut() {
        stdin
            .write_all(message.as_bytes())
            .map_err(|e| format!("Failed to write to gpg command: {}", e))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|e| format!("Failed to wait for gpg command: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Error result for gpg command: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    // 非对称加密的结果
    let passphrase = hash(answer);
    let asymmetric_encrypted = &output.stdout;
    let mut child = Command::new(get_gpg_cmd()?)
        .args([
            "--symmetric",
            "--cipher-algo",
            "AES256",
            "--batch",
            "--yes",
            "--passphrase",
            &passphrase,
            "--output",
            output_file,
        ])
        .stdin(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to execute gpg command: {}", e))?;

    if let Some(stdin) = child.stdin.as_mut() {
        stdin
            .write_all(asymmetric_encrypted)
            .map_err(|e| format!("Failed to write to gpg command: {}", e))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|e| format!("Failed to wait for gpg command: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Error result for gpg command: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    Ok(())
}

static GPG_PATH_CACHE: OnceLock<Mutex<Option<String>>> = OnceLock::new();
fn get_gpg_cmd() -> Result<String, String> {
    let cache = GPG_PATH_CACHE.get_or_init(|| Mutex::new(None));
    if let Ok(cached_path) = cache.lock() {
        if let Some(ref path) = *cached_path {
            return Ok(path.clone());
        }
    }

    let found_path = find_gpg_path()?;
    if let Ok(mut cached_path) = cache.lock() {
        *cached_path = Some(found_path.clone());
    }
    Ok(found_path)
}

fn find_gpg_path() -> Result<String, String> {
    // macOS上GPG的常见安装路径
    let possible_paths = [
        "/opt/homebrew/bin/gpg",
        "/usr/local/bin/gpg",
        "/usr/bin/gpg",
        "/opt/local/bin/gpg",
        "/usr/local/MacGPG2/bin/gpg",
        "/usr/local/bin/gpg2",
        "gpg",
    ];

    for path in &possible_paths {
        if Path::new(path).exists() {
            return Ok(path.to_string());
        }
    }

    // 尝试使用which命令查找，只返回第一个结果
    if let Ok(output) = Command::new("which").arg("gpg").output() {
        if output.status.success() {
            let full_output = String::from_utf8_lossy(&output.stdout);
            if let Some(first_line) = full_output.lines().next() {
                let path = first_line.trim().to_string();
                if !path.is_empty() {
                    return Ok(path);
                }
            }
        }
    }

    Err("GPG not found in system, please install it".to_string())
}

static GIT_PATH_CACHE: OnceLock<Mutex<Option<String>>> = OnceLock::new();

fn get_git_cmd() -> Result<String, String> {
    let cache = GIT_PATH_CACHE.get_or_init(|| Mutex::new(None));
    if let Ok(cached_path) = cache.lock() {
        if let Some(ref path) = *cached_path {
            return Ok(path.clone());
        }
    }
    let found_path = find_git_path()?;
    if let Ok(mut cached_path) = cache.lock() {
        *cached_path = Some(found_path.clone());
    }

    Ok(found_path)
}

fn find_git_path() -> Result<String, String> {
    let possible_paths = [
        "/usr/bin/git",
        "/usr/local/bin/git",
        "/opt/homebrew/bin/git",
        "/opt/local/bin/git",
        "git",
    ];

    for path in &possible_paths {
        if Path::new(path).exists() {
            return Ok(path.to_string());
        }
    }

    // 尝试使用which命令查找，只返回第一个结果
    if let Ok(output) = Command::new("which").arg("git").output() {
        if output.status.success() {
            let full_output = String::from_utf8_lossy(&output.stdout);
            if let Some(first_line) = full_output.lines().next() {
                let path = first_line.trim().to_string();
                if !path.is_empty() {
                    return Ok(path);
                }
            }
        }
    }

    Err("Git not found in system, please install it".to_string())
}

fn create_project_dir() -> Result<(), String> {
    if !is_git_available()? {
        return Ok(());
    }
    if !is_gpg_available()? {
        return Ok(());
    }

    let home_dir = dirs::home_dir();
    if home_dir.is_none() {
        return Err("Home directory not found".to_string());
    }
    let project_root = home_dir.unwrap().join(".safesecrets");
    if !project_root.exists() {
        fs::create_dir_all(&project_root)
            .map_err(|e| format!("Failed to create project root: {}", e))?;
    }

    env::set_current_dir(&project_root).map_err(|e| format!("Failed to set current dir: {}", e))?;

    if !Path::new("./.git").exists() {
        let output = Command::new(get_git_cmd()?)
            .args(["init"])
            .output()
            .map_err(|e| format!("Failed to execute git command: {}", e))?;

        if !output.status.success() {
            return Err(format!(
                "Error result for git command: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        let _ = Command::new(get_git_cmd()?)
            .args(["checkout", "-b", "main"])
            .output();
    }

    Ok(())
}

fn git_upstream_exists() -> Result<bool, String> {
    let output = Command::new(get_git_cmd()?)
        .args(["remote", "-vv"])
        .output()
        .map_err(|e| format!("Failed to execute git command: {}", e))?;

    if output.status.success() {
        let output_str = String::from_utf8_lossy(&output.stdout);
        let lines = output_str
            .lines()
            .filter(|&x| x.contains("origin/main"))
            .collect::<Vec<_>>();
        if lines.len() > 0 {
            return Ok(true);
        }
    }
    Ok(false)
}

fn hash_twice(answer: &str) -> String {
    let mut hasher1 = tiny_keccak::Keccak::v256();
    let mut output1 = [0u8; 32];
    hasher1.update(answer.as_bytes());
    hasher1.finalize(&mut output1);

    let mut hasher2 = tiny_keccak::Keccak::v256();
    let mut output2 = [0u8; 32];
    hasher2.update(&output1);
    hasher2.finalize(&mut output2);

    hex::encode(output2)
}

fn hash(answer: &str) -> String {
    let mut hasher1 = tiny_keccak::Keccak::v256();
    let mut output1 = [0u8; 32];
    hasher1.update(answer.as_bytes());
    hasher1.finalize(&mut output1);
    hex::encode(output1)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            add_secrets,
            delete_secrets,
            decrypt_secrets,
            get_secrets_list,
            add_email_and_question,
            get_gpg_email,
            get_security_question,
            git_repository_exists,
            is_git_available,
            is_gpg_available,
            exit_app,
            add_git_repository,
            verify_security_question
        ])
        .setup(|app| {
            create_project_dir()?;
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?
            }
            Ok(())
        })
        .on_window_event(|_, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                clear_cache();
            }
        })
        .run(tauri::generate_context!())
        .expect("Failed to start safesecrets");
}

#[allow(dead_code)]
fn clear_cache() {
    if let Some(cache) = GIT_PATH_CACHE.get() {
        if let Ok(mut cached_path) = cache.lock() {
            *cached_path = None;
        }
    }
    if let Some(cache) = GPG_PATH_CACHE.get() {
        if let Ok(mut cached_path) = cache.lock() {
            *cached_path = None;
        }
    }
}
