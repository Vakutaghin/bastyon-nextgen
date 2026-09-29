---
keywords: [development, developer, local app, b_manifest.json, SDK, publish an app]
---

# Your own mini app

How a developer can open their mini app in Bastyon before publishing it in the catalog.

## What an app needs

A mini app is a website. Its address must serve:

- `b_manifest.json` — the app description: identifier, name, description, the author’s Bastyon address, the site address and the list of permissions it needs;
- `b_icon.png` — the icon.

The manifest fields and examples are in the developer documentation, see below.

## Loading it locally

1. Open [Mini-apps](bastyon://miniapps) and press **“Load local app”**.
2. **“App address (scope)”** — the address that serves `b_manifest.json`, for example `https://dev.example.com/app`. For a dev server on your own computer, `http://localhost:3000` works too; other sites only over HTTPS.
3. **“Display name (optional)”** — if you leave it empty, the name from the manifest is used.
4. Press **“Load”**.

The app opens and stays in the **“Installed”** section until you delete it.

An app from a home network address — `192.168.…`, `….local` and the like — will not load: a stranger’s app must not reach your router or printer. Nor can an app take the identifier of an app that comes with Bastyon or was already loaded from another address: otherwise a fake would inherit its permissions.

## SDK and documentation

The developer documentation is at [docs.pocketnet.app](https://docs.pocketnet.app/dev/apps/miniapps/get-started.html): getting started, permissions and the SDK. It also links to ready-made templates.

The connection between an app and Bastyon works the same way as in the previous Bastyon app: the same SDK actions and the same permissions, so the documentation applies to this app as well.

## Publishing in the catalog

An app cannot be published from here yet. Apps are registered and published in the previous Bastyon app, on the [bastyon.com/devapplication](https://bastyon.com/devapplication) page, following the documentation. A published app goes onto the Bastyon network and shows up here too, in the **“Catalog”** section.

## See also

- [Mini apps](mini-apps.md)
- [Mini app permissions](mini-app-permissions.md)
