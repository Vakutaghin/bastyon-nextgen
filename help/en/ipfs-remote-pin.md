---
keywords: [remote pin, pinning service, Pinata, Filebase, file storage, availability]
---

# Storing on a service

How to keep your files available even when your computer is off: connect a remote pinning service.

## Why

Your files are available while your computer serves them. A remote pinning service keeps copies and serves them around the clock. Bastyon has no such service of its own: you connect a third-party one, with your own account there.

Any service that supports the IPFS Pinning Service API will do, for example:

- Pinata — API address `https://api.pinata.cloud/psa`;
- Filebase — API address `https://api.filebase.io/v1/ipfs`;
- ipfs-cluster on your own server.

Services usually offer some free space and charge for more — check the terms on their sites.

## Connecting

1. Sign up with the service and get an access token in your account there.
2. Open [My files](my-files.md) and press **“Connect a service…”**.
3. Enter the service’s API address — it must start with `https://` — and the token. Press **“Save”**.

From then on, new files you share are copied to the service automatically. The address and the token are kept by the [IPFS module](ipfs-module.md) on this computer; if you remove the module, you will have to connect the service again.

## Statuses

Next to each file in the list you see what is happening with its copy:

- **“queued for the service”** and **“copying to the service”** — the service is fetching the file from your computer. Keep Bastyon open until copying is done; the status updates by itself;
- **“kept by the service”** — the copy is ready, and the file is available even with the computer off;
- **“the service could not keep it”** — most often the service did not find the computer online, or it ran out of space. Press **“Keep on the service”** to try again.

Files you shared before connecting the service, and files received from a chat, are not copied to it automatically: they have the same **“Keep on the service”** button.

## Disconnecting

**“My files”** → **“Service settings…”** → **“Remove service”**. Copies already on the service stay there — you can delete them in your account on the service.

**“Stop sharing”** on a file with a service connected also deletes its copy on the service.

## See also

- [My files](my-files.md)
- [Files and IPFS](ipfs.md)
