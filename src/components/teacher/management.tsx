"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { command } from "../ui/actions";
export function InviteStudent() {
  const [message, setMessage] = useState("");
  return (
    <form
      className="panel"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        try {
          const { token } = await command<{ token: string }>({
            action: "invite",
            email: form.get("email"),
          });
          setMessage(
            `${window.location.origin}/student/home?invitation=${token}`,
          );
        } catch (e) {
          setMessage((e as Error).message);
        }
      }}
    >
      <h2>Invite a student</h2>
      <label>
        Student email
        <input name="email" type="email" required />
      </label>
      <button>Create invitation link</button>
      <small>
        Copy the link and share it with your student. No email is sent
        automatically.
      </small>
      {message && (
        <p role="status" style={{ overflowWrap: "anywhere" }}>
          {message}
        </p>
      )}
    </form>
  );
}
export function AssignCourse({
  courses,
  students,
}: {
  courses: { id: string; title: string }[];
  students: { id: string; name: string }[];
}) {
  const [message, setMessage] = useState("");
  return (
    <form
      className="panel"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        try {
          await command({
            action: "assign",
            courseId: f.get("courseId"),
            studentId: f.get("studentId"),
            instructions: f.get("instructions"),
          });
          setMessage("Course assigned.");
        } catch (e) {
          setMessage((e as Error).message);
        }
      }}
    >
      <h2>Assign a published course</h2>
      <label>
        Student
        <select name="studentId" required>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Course
        <select name="courseId" required>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        Instructions
        <textarea name="instructions" />
      </label>
      <button disabled={!students.length || !courses.length}>
        Assign course
      </button>
      <p role="status">{message}</p>
    </form>
  );
}
export function AddMedia() {
  const [message, setMessage] = useState("");
  const router = useRouter();
  return (
    <form
      className="panel"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        try {
          await command({
            action: "addMedia",
            title: f.get("title"),
            url: f.get("url"),
            kind: f.get("kind"),
            rights: {
              status: f.get("rights"),
              owner: f.get("owner"),
              notes: "",
            },
          });
          setMessage("Media saved.");
          router.refresh();
        } catch (e) {
          setMessage((e as Error).message);
        }
      }}
    >
      <h2>Add hosted media</h2>
      <div className="row">
        <label>
          Title
          <input name="title" required />
        </label>
        <label>
          Type
          <select name="kind">
            <option>IMAGE</option>
            <option>AUDIO</option>
            <option>VIDEO</option>
            <option>MUSICXML</option>
          </select>
        </label>
      </div>
      <label>
        HTTPS media URL
        <input name="url" type="url" required placeholder="https://…" />
      </label>
      <small>
        Use a direct media URL. MusicXML hosts must allow cross-origin access.
      </small>
      <div className="row">
        <label>
          Rights
          <select name="rights">
            <option>ORIGINAL</option>
            <option>PUBLIC_DOMAIN</option>
            <option>LICENSED</option>
            <option>PERMISSION_GRANTED</option>
            <option>UNKNOWN</option>
          </select>
        </label>
        <label>
          Rights owner
          <input name="owner" required />
        </label>
      </div>
      <button>Save media</button>
      <p role="status">{message}</p>
    </form>
  );
}
