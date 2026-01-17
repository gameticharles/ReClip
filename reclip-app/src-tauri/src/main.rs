// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use clap::Parser;
use arboard::Clipboard;

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Cli {
    /// Copy content to clipboard
    #[arg(long)]
    copy: Option<String>,

    /// Print current clipboard content
    #[arg(long)]
    paste: bool,
}

fn main() {
    let args = Cli::parse();

    // Handle CLI commands
    if let Some(content) = args.copy {
        match Clipboard::new() {
            Ok(mut clipboard) => {
                if let Err(e) = clipboard.set_text(content) {
                    eprintln!("Error copying to clipboard: {}", e);
                    std::process::exit(1);
                }
                // We exit successfully after copying. 
                // The running ReClip instance (if any) will detect the change via its listener.
                std::process::exit(0);
            },
            Err(e) => {
                eprintln!("Failed to initialize clipboard: {}", e);
                std::process::exit(1);
            }
        }
    }

    if args.paste {
         match Clipboard::new() {
            Ok(mut clipboard) => {
                match clipboard.get_text() {
                    Ok(text) => {
                        print!("{}", text); // Print to stdout
                        std::process::exit(0);
                    },
                    Err(e) => {
                        eprintln!("Error reading clipboard: {}", e);
                        std::process::exit(1);
                    }
                }
            },
            Err(e) => {
                eprintln!("Failed to initialize clipboard: {}", e);
                std::process::exit(1);
            }
        }
    }

    // Normal run
    reclip_app_lib::run()
}
