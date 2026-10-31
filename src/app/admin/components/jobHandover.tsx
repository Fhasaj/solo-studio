'use client';

import { useRef, useState } from "react";
import type { HandoverFile, Project } from "@/lib/query/clients.query";
import { formatDateTime } from "@/lib/format";
import { api, showError, showSuccess } from "./api";
import { dangerButton, TextArea, TextField } from "./fields";

const MAX_BYTES = 100 * 1024 * 1024;

function formatSize(bytes: number) {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

// The final code and documents. Stored encrypted; the client can only download them once everything is paid.
export default function JobHandover({ project, files, released, reload }: { project: Project; files: HandoverFile[]; released: boolean; reload: () => Promise<unknown> }) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [notes, setNotes] = useState(project.handoverNotes);
  const [repoUrl, setRepoUrl] = useState(project.handoverRepoUrl);

  const upload = (file: File) => {
    if (file.size > MAX_BYTES) return showError(new Error("Files must be 100 MB or smaller. For bigger projects, add a repository link instead."));
    const form = new FormData();
    form.append("projectId", String(project.id));
    form.append("file", file);
    // XMLHttpRequest rather than fetch, for upload progress on big archives
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload/handover");
    xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = async () => {
      setProgress(null);
      if (input.current) input.current.value = "";
      const json = JSON.parse(xhr.responseText || "{}");
      if (xhr.status !== 200) return showError(new Error(json.error ?? "Upload failed"));
      showSuccess("Uploaded and encrypted");
      await reload();
    };
    xhr.onerror = () => {
      setProgress(null);
      showError(new Error("Upload failed"));
    };
    setProgress(0);
    xhr.send(form);
  };

  const saveDetails = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await api("/api/admin/handover", "PUT", { projectId: project.id, notes, repoUrl });
      showSuccess("Handover details saved");
      await reload();
    } catch (error) {
      showError(error);
    }
  };

  const remove = async (file: HandoverFile) => {
    if (!window.confirm(`Delete ${file.fileName}?`)) return;
    try {
      await api("/api/admin/handover", "DELETE", { id: file.id });
      await reload();
    } catch (error) {
      showError(error);
    }
  };

  return (
    <section className="card p-6">
      <h2 className="text-lg font-FiraSans-Bold">Code handover</h2>
      <p className={`mt-1 text-sm ${released ? "text-successColour" : "text-mutedColour"}`}>
        {released
          ? "Everything is paid: the client can download these now."
          : "Locked: the client sees these only after the final payment. They're emailed when it unlocks."}
      </p>

      <ul className="mt-4 flex flex-col gap-2">
        {files.map((file) => (
          <li key={file.id} className="rounded-lg border border-borderColour bg-backgroundColour p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-FiraSans-Bold">{file.fileName}</span>
              <button type="button" className={dangerButton} onClick={() => remove(file)}>Delete</button>
            </div>
            <p className="text-xs text-mutedColour">
              {formatSize(file.size)} · uploaded {file.uploadedAt ? formatDateTime(file.uploadedAt) : ""} · downloaded {file.downloads} time{file.downloads === 1 ? "" : "s"}
            </p>
            <p className="text-xs text-mutedColour break-all">SHA-256 {file.sha256}</p>
          </li>
        ))}
      </ul>

      <div className="mt-3">
        <button type="button" className="btn-secondary" disabled={progress !== null} onClick={() => input.current?.click()}>
          {progress !== null ? `Uploading… ${progress}%` : "Upload a file (zip, up to 100 MB)"}
        </button>
        <input ref={input} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </div>

      <form onSubmit={saveDetails} className="mt-5 pt-5 border-t border-borderColour flex flex-col gap-3">
        <TextField id="handover-repo" label="Repository link (optional)" value={repoUrl} onChange={setRepoUrl} placeholder="https://github.com/…" help="For big projects: transfer or share the repository, then link it here. Shown only after the final payment." />
        <TextArea id="handover-notes" label="Handover notes (shown with the downloads)" rows={4} maxLength={5000} value={notes} onChange={setNotes} help="How to run or deploy it, where the documentation is. Don't put passwords here: share those through a password manager." />
        <div>
          <button type="submit" className="btn-primary">Save handover details</button>
        </div>
      </form>
    </section>
  );
}
