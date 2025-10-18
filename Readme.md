# Lesion - A GNOME Shell CSS Manager

Lesion is a simple yet powerful GNOME Shell extension that allows you to apply custom CSS stylesheets to your desktop, giving you the freedom to tweak and personalize your GNOME experience.

Whether you want to apply a few small fixes or completely overhaul your UI, Lesion provides a straightforward interface to manage both bundled and user-provided stylesheets.

## Features

* **Bundled Styles:** Easily enable or disable stylesheets that come packaged with the extension.
* **Custom User Styles:** Add your own .css files from anywhere on your computer.
* **Flexible Management:** For each custom style, you can:
  * Toggle it on or off.
  * Open the file directly in your default text editor.
  * Remove it from the list without deleting the original file.
* **Modern UI:** A clean and simple preferences window built with Adwaita for a native look and feel.

## Installation

There are three ways to install Lesion:

1. GNOME Extensions Website (Recommended)

   * Visit the Lesion page on [extensions.gnome.org](https://extensions.gnome.org/) (once published).
   * Click the on/off switch to install and enable the extension automatically.

2. Manual Installation (from Release)

   This method is for installing a pre-packaged .zip file from a release.

   * Download the latest `lesion@lethil.zip` from the [GitHub Releases page](https://www.google.com/search?q=https://github.com/khensolomon/lesion/releases).
   * Unzip the downloaded file.
   * Copy the resulting lesion@lethil directory to \~/.local/share/gnome-shell/extensions/.
   * Restart GNOME Shell (Alt + F2, type r, press Enter) or log out and back in.
   * Enable the extension using the Extensions app.

3. Installation from Source (for Development)

   This method is for developers who want to contribute or test the latest changes.

   1. Clone the repository:

      ```bash
      git clone https://github.com/khensolomon/lesion.git

      cd lesion
      ```

   2. Compile the GSettings schemas:

      ```bash
      glib-compile-schemas schemas/
      ```

   3. Link the extension directory to your local extensions folder:

      ```bash
      ln -s "$(pwd)" \~/.local/share/gnome-shell/extensions/lesion@lethil
      ```

   4. Restart GNOME Shell (`Alt` + `F2`, type `r`, press `Enter`).
   5. Enable the extension using the Extensions app.

## Usage

After installation, open the Extensions app, find "Lesion", and click the settings icon.

From the preferences window, you can toggle the bundled styles in the "Bundled CSS Style" section or add your own files using the "Custom CSS Style" section. Any changes you make are applied in real-time.

## Contributing & Feedback

Found a bug or have a feature request? Please [open an issue](https://www.google.com/search?q=https://github.com/khensolomon/lesion/issues) on GitHub\!
