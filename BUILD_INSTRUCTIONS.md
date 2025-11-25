# Build Instructions

The automated build environment is missing the necessary tools (Node.js and Rust).

## Prerequisites

1.  **Node.js** (LTS version recommended)
2.  **Rust** (via rustup)
3.  **C++ Build Tools** (Visual Studio Build Tools with "Desktop development with C++")

## Automated Setup

I have created a PowerShell script to help you install Node.js and Rust using `winget`.

1.  Open a PowerShell terminal as Administrator (recommended for installations).
2.  Run the script:
    ```powershell
    .\setup_env.ps1
    ```
3.  **Restart your terminal** to ensure the new tools are in your PATH.

## Manual Build Steps

Once the tools are installed:

1.  Navigate to the app directory:
    ```bash
    cd apps/hopcoder-shell
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Run the development server:
    ```bash
    npm run tauri dev
    ```

4.  Or build for production:
    ```bash
    npm run tauri build
    ```
