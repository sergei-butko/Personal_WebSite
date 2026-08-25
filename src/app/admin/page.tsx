import { Editor } from './editor'

/**
 * /admin — the content editor.
 *
 * A static page like every other; all the behaviour is client-side, and the
 * only server involved is the Cloudflare Worker in workers/admin-api, which
 * exists because writing to Cloudinary needs an API secret that must never be
 * shipped to a browser.
 *
 * There is no route guard here and there does not need to be one. The page is
 * inert without a session, the snapshots it reads are already public, and the
 * only thing worth protecting — the write path — is protected where it is
 * enforceable, in the Worker.
 */
export default function AdminPage() {
  return <Editor />
}
