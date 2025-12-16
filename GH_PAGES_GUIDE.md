
# How to Publish Prismata to GitHub Pages

Your repository is now configured for **Automatic Deployment**.

## Steps to Publish

1.  **Push to GitHub**:
    ```bash
    git init
    git add .
    git commit -m "Initial commit of Prismata"
    git branch -M main
    git remote add origin https://github.com/FreddyAyala/Prismata.git
    git push -u origin main
    ```

2.  **Activate Settings**:
    *   Go to your Repository on GitHub.
    *   Click **Settings** > **Pages** (sidebar).
    *   Under **Build and deployment**, select **Source** -> **GitHub Actions**.
    *   (The workflow created in `.github/workflows/deploy.yml` will handle the rest).

3.  **Wait**:
    *   Click the "Actions" tab to see the build running.
    *   Once green, your site will be live at: `https://YOUR_USERNAME.github.io/Prismata/`.

## Manual Method (Alternative)
If you prefer not to use Actions, you can run:
```bash
npm run build
```
And manually upload the contents of the `dist/` folder to a web host.
