# Permanent Android release signing

RiseFit release APKs must always use one private signing key. Keep the keystore outside the repository and back it up securely. Never commit the `.jks` file or share its passwords in chat, issues, pull requests, or logs.

## 1. Generate the key on your own Windows computer

Open PowerShell on a computer with JDK 21 (or another JDK that provides `keytool`). Run:

```powershell
$KeyPath = Join-Path $env:USERPROFILE "risefit-release.jks"
keytool -genkeypair -v -keystore $KeyPath -storetype JKS -keyalg RSA -keysize 4096 -validity 10000 -alias risefit
```

Choose a strong keystore password and keep it in a password manager. When `keytool` asks for the key password, press Enter to reuse the keystore password. The alias is `risefit`. The validity period is 10,000 days.

Create a base64 copy in the clipboard (the actual keystore stays in your user profile):

```powershell
$Bytes = [System.IO.File]::ReadAllBytes($KeyPath)
$Encoded = [Convert]::ToBase64String($Bytes)
Set-Clipboard -Value $Encoded
Remove-Variable Bytes, Encoded
```

## 2. Add repository Actions secrets

In the RiseFit GitHub repository, open **Settings → Secrets and variables → Actions → New repository secret**. Add these four repository secrets:

| Secret name | Value |
|---|---|
| `RISEFIT_KEYSTORE_BASE64` | Paste the clipboard content from step 1 |
| `RISEFIT_KEYSTORE_PASSWORD` | The keystore password you chose |
| `RISEFIT_KEY_ALIAS` | `risefit` |
| `RISEFIT_KEY_PASSWORD` | The key password (same as the keystore password if you pressed Enter) |

Do not paste any of these values into a chat or commit them to the repository. GitHub documents this process at https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets.

## 3. Build the signed APK

After adding all four secrets, open **Actions → RiseFit Android build → Run workflow** and run it on `main`.

The workflow continues to create a debug APK for CI testing. When the four secrets are present, it also creates the installable, permanently signed `RiseFit-release-apk` artifact. Only use the release APK for installs intended to receive future updates.

The Gradle signing configuration reads passwords from environment variables. The keystore is decoded only into the temporary GitHub runner directory and is not uploaded as an artifact.

The Android version code is derived from `package.json` version, so increment the package version for each future release.

## 4. Back up the key

Keep at least two secure backups of `risefit-release.jks`, separate from the GitHub repository (for example, an encrypted backup and a password-manager secure file). Keep both passwords in your password manager. Loss of the key can prevent future APK updates signed with this identity.

## One-time install transition

Older RiseFit APKs were built using an ephemeral GitHub Actions debug signing key. Its private key was not retained, so the first APK signed with this permanent key cannot update those old debug-signed installs in place. Android requires an installed app and its update to have matching signing certificates.

Do not uninstall the old app until a signed release APK has been successfully built and downloaded. Before the one-time uninstall, write down or screenshot every alarm label and time so the alarms can be recreated. Uninstalling removes the old app's private local data and saved alarm settings. After installing the first permanent release, recreate the alarms. All subsequent release APKs from this workflow will use the same permanent key and can update in place.
