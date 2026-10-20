import {ShortsStudio,ShortsCaptureControls} from './shorts-ui';
import { ObsLinks } from "./obs-links";
import { ProgressProfile, ProgressSaveStatus } from "./game-profile";
import { scalesLibrary } from "./scales-library";
import { collectionProgress, type ProgressMap } from "./collection-progress";
import { CollectionProgressView } from "./collection-progress-view";
import { practiceLibrary } from "./practice-library";
import { classicalLibrary } from "./classical-library";
import { moonlightLibrary } from "./moonlight-library";
import type { Exercise } from "./sight-library";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Shell } from "../src/components/ui/shell";
import { ActionButton, Empty, command } from "../src/components/ui/actions";
import {
  CourseBuilder,
  CreateCourse,
} from "../src/components/teacher/course-builder";
import { LessonRenderer } from "../src/components/lesson/renderer";
import {
  InviteStudent,
  AssignCourse,
  AddMedia,
} from "../src/components/teacher/management";
import { MidiSetup, VirtualKeyboard } from "../src/components/midi/setup";
import type { Lesson } from "../src/domains/blocks/schema";
import type {
  Asset,
  Course,
  Enrollment,
  HostedActor,
  Performance,
  Recording,
  Version,
} from "./service";
import Link from "./navigation";
import "../src/app/globals.css";
import { registerWebMcp } from "./webmcp";
import { SightReading, type SightAttempt } from "./sight-reading";
import { ObsOverlay } from "./obs";
interface Data {
  sightAttempts?: SightAttempt[];
  collectionProgress?: ProgressMap;
  practiceExercises?: Exercise[];
  actor: HostedActor;
  course?: Course;
  version?: Version;
  enrollment?: Enrollment;
  lesson?: Lesson;
  recordings?: Recording[];
  assets?: Asset[];
  courses?: Course[] | { enrollment: Enrollment; version: Version }[];
  students?: { id: string; name: string }[];
  progress?: { lessonId: string }[];
  performances?: Performance[];
  analytics?: {
    students: { name: string; enrollment: Enrollment }[];
    performances: Performance[];
    progress: unknown[];
  };
  users?: { id: string; name: string; email: string }[];
  roles?: { userId: string; role: string }[];
  audit?: { id: string; action: string; createdAt: string }[];
  assignments?: { id: string; instructions: string; status: string }[];
}
function App() {
  const [path, setPath] = useState(
      location.pathname === "/" ? "/teacher/dashboard" : location.pathname,
    ),
    [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [status, setStatus] = useState(200),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const move = () => {
        setData(null);
        setPath(
          location.pathname === "/" ? "/teacher/dashboard" : location.pathname,
        );
        // Reload even when navigation resolves to the current route.
        setRefresh((r) => r + 1);
      },
      reload = () => setRefresh((r) => r + 1);
    window.addEventListener("popstate", move);
    window.addEventListener("piano:navigate", move);
    window.addEventListener("piano:refresh", reload);
    const cleanup = registerWebMcp();
    return () => {
      window.removeEventListener("popstate", move);
      window.removeEventListener("piano:navigate", move);
      window.removeEventListener("piano:refresh", reload);
      cleanup();
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    setError("");
    void fetch(`/api/platform?path=${encodeURIComponent(path)}`)
      .then(async (response) => {
        const body = await response.json();
        if (cancelled) return;
        setStatus(response.status);
        if (!response.ok) {
          setData(null);
          setError(body.error ?? "Unable to load this page");
        } else setData(body);
      })
      .catch(() => {
        if (!cancelled) setError("Unable to connect. Please try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [path, refresh]);
  if (error)
    return (
      <main id="main">
        <h1>
          {status === 401
            ? "Welcome to PianoPath"
            : status === 403
              ? "Access restricted"
              : "Unable to load this page"}
        </h1>
        <p role="alert">{error}</p>
        {status === 401 ? (
          <a
            href={`/signin-with-chatgpt?return_to=${encodeURIComponent(path)}`}
            target="_top"
          >
            Sign in with ChatGPT
          </a>
        ) : (
          <div className="row">
            <button onClick={() => setRefresh((r) => r + 1)}>Try again</button>
            <Link href="/student/home">Student workspace</Link>
          </div>
        )}
      </main>
    );
  if (!data)
    return (
      <main id="main">
        <p role="status">Loading PianoPath…</p>
      </main>
    );
  const area = path.startsWith("/teacher")
    ? "teacher"
    : path.startsWith("/admin")
      ? "admin"
      : "student";
  return (
    <Shell area={area} name={data.actor.name} roles={data.actor.roles}>
      <ProgressSaveStatus />
      <Content key={path} path={path} data={data} />
    </Shell>
  );
}
function Content({ path, data }: { path: string; data: Data }) {
  if(path === "/shorts") return <ShortsStudio/>;
  if (path.startsWith("/teacher/courses/") && data.course && data.version)
    return (
      <>
        <CourseBuilder
          fileUploads
          courseId={data.course.id}
          initialVersion={data.version}
          initialVisibility={data.course.visibility}
          initialRecordings={data.recordings ?? []}
          assets={data.assets ?? []}
          canPublish={
            data.course.ownerId === data.actor.id ||
            data.actor.roles.includes("ADMIN")
          }
        />
        {data.course.status === "PUBLISHED" &&
          data.course.visibility !== "PRIVATE" && (
            <p className="panel">
              Enrollment link:{" "}
              <a href={`/courses/${data.course.id}`}>
                {location.origin}/courses/{data.course.id}
              </a>
            </p>
          )}
      </>
    );
  if (path.startsWith("/student/courses/") && data.version && data.enrollment) {
    if (data.lesson)
      return (
        <>
          <p>
            <Link href={`/student/courses/${data.enrollment.id}`}>
              Back to course
            </Link>
          </p>
          <LessonRenderer
            lesson={data.lesson}
            recordings={data.recordings ?? []}
            assets={data.assets ?? []}
            enrollmentId={data.enrollment.id}
          />
        </>
      );
    return (
      <>
        <p className="eyebrow">Version {data.version.number}</p>
        <h1>{data.version.metadata.title}</h1>
        {data.version.tree.modules.map((m) => (
          <section key={m.id} className="panel">
            <h2>{m.title}</h2>
            {m.lessons.map((l) => (
              <p key={l.id}>
                <Link
                  href={`/student/courses/${data.enrollment!.id}/lessons/${l.id}`}
                >
                  {l.title}
                </Link>
                {data.progress?.some((p) => p.lessonId === l.id) && (
                  <span className="badge">Completed</span>
                )}
              </p>
            ))}
          </section>
        ))}
      </>
    );
  }
  if (path.startsWith("/courses/") && data.course)
    return (
      <>
        <h1>{data.course.metadata.title}</h1>
        <p>{data.course.metadata.description}</p>
        {data.course.metadata.accessPolicy === "FREE" ? (
          <ActionButton
            label="Enroll in course"
            data={{ action: "enroll", courseId: data.course.id }}
            redirectTo="/student/learn"
          />
        ) : (
          <p>Ask the teacher to grant access to this course.</p>
        )}
      </>
    );
  const section = path.split("/")[2] ?? "home";
  if (section === "settings")
    return (
      <>
        <h1>Settings</h1>
        <MidiSetup />
        <VirtualKeyboard />
        <p className="spacer">Signed in as {data.actor.email}</p>
      </>
    );
  if (path.startsWith("/teacher/")) {
    const courses = (data.courses ?? []) as Course[],
      analytics = data.analytics!;
    if (section === "courses")
      return (
        <>
          <p className="eyebrow">Teacher Studio</p>
          <h1>Courses</h1>
          <CreateCourse />
          {courses.length ? (
            <div className="grid">
              {courses.map((c) => (
                <div className="panel" key={c.id}>
                  <span className="badge">
                    {c.status} · {c.visibility}
                  </span>
                  <h2>
                    <Link href={`/teacher/courses/${c.id}`}>
                      {c.metadata.title}
                    </Link>
                  </h2>
                  <Link href={`/teacher/courses/${c.id}`}>
                    Open course builder
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="Create your first course">
              Add modules, lessons, and interactive MIDI activities.
            </Empty>
          )}
        </>
      );
    if (section === "media")
      return (
        <>
          <h1>Media library</h1>
          <AddMedia />
          {[...(data.assets ?? []), ...(data.recordings ?? [])].map((r) => (
            <div className="panel" key={r.id}>
              <h2>{r.title}</h2>
              <span className="badge">{"kind" in r ? r.kind : "MIDI"}</span>
            </div>
          ))}
          {!data.assets?.length && !data.recordings?.length && (
            <Empty title="No media yet">
              Add hosted media or record MIDI in a lesson.
            </Empty>
          )}
        </>
      );
    if (section === "students")
      return (
        <>
          <h1>Your students</h1>
          <div className="grid">
            <InviteStudent />
            <AssignCourse
              courses={courses
                .filter((c) => c.status === "PUBLISHED")
                .map((c) => ({ id: c.id, title: c.metadata.title }))}
              students={data.students ?? []}
            />
          </div>
          {data.students?.length ? (
            data.students.map((s) => <p key={s.id}>{s.name}</p>)
          ) : (
            <Empty title="No connected students">
              Share an invitation link to start assigning courses.
            </Empty>
          )}
          <h2>Lesson completions</h2>
          <p>
            {analytics.progress.length} completed lessons across your courses.
          </p>
        </>
      );
    if (section === "content-library")
      return (
        <>
          <h1>Content library</h1>
          <Empty title="No reusable content yet">
            Course lessons are available in Courses. Dedicated sight-reading,
            practice and repertoire libraries will be added later.
          </Empty>
        </>
      );
    if (!["dashboard", "analytics"].includes(section))
      return <Empty title="Page not found" />;
    return (
      <>
        <header className="page-head">
          <div>
            <p className="eyebrow">Teacher Studio</p>
            <h1>
              {section === "analytics"
                ? "Analytics"
                : `Welcome, ${data.actor.name.split(" ")[0]}`}
            </h1>
          </div>
          <Link href="/teacher/courses">Manage courses</Link>
        </header>
        <div className="grid">
          <div className="metric">
            Courses<strong>{courses.length}</strong>
          </div>
          <div className="metric">
            Published
            <strong>
              {courses.filter((c) => c.status === "PUBLISHED").length}
            </strong>
          </div>
          <div className="metric">
            Enrolled students
            <strong>
              {
                new Set(analytics.students.map((s) => s.enrollment.studentId))
                  .size
              }
            </strong>
          </div>
          <div className="metric">
            Completed lessons<strong>{analytics.progress.length}</strong>
          </div>
        </div>
        <h2 className="spacer">Recent performances</h2>
        {analytics.performances.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Score</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {analytics.performances.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {analytics.students.find(
                        (s) => s.enrollment.studentId === p.userId,
                      )?.name ?? "Student"}
                    </td>
                    <td>{p.score}%</td>
                    <td>{p.passed ? "Passed" : "Keep practicing"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No performances yet">
            Student performances will appear here after a course activity is
            completed.
          </Empty>
        )}
      </>
    );
  }
  if (path.startsWith("/admin/")) {
    if (section === "users" || section === "teachers")
      return (
        <>
          <h1>{section === "users" ? "Users" : "Teachers"}</h1>
          {data.users
            ?.filter(
              (u) =>
                section === "users" ||
                data.roles?.some(
                  (r) => r.userId === u.id && r.role === "TEACHER",
                ),
            )
            .map((u) => (
              <div className="panel" key={u.id}>
                <h2>{u.name}</h2>
                <p>{u.email}</p>
                <p>
                  {data.roles
                    ?.filter((r) => r.userId === u.id)
                    .map((r) => r.role)
                    .join(" · ")}
                </p>
                {!data.roles?.some(
                  (r) => r.userId === u.id && r.role === "TEACHER",
                ) && (
                  <ActionButton
                    label="Grant Teacher role"
                    data={{
                      action: "grantRole",
                      userId: u.id,
                      role: "TEACHER",
                    }}
                  />
                )}
              </div>
            ))}
        </>
      );
    if (section === "courses" || section === "published-content")
      return (
        <>
          <h1>Courses</h1>
          {(data.courses as Course[])
            .filter((c) => section === "courses" || c.status === "PUBLISHED")
            .map((c) => (
              <div className="panel" key={c.id}>
                <h2>{c.metadata.title}</h2>
                <p>{c.status}</p>
                <ActionButton
                  label="Archive course"
                  data={{
                    action: "moderate",
                    courseId: c.id,
                    status: "ARCHIVED",
                    notes: "Archived through Admin",
                  }}
                />
              </div>
            ))}
        </>
      );
    if (section === "system")
      return (
        <>
          <h1>System</h1>
          <p>Hosted on Sites · D1 persistence · Sites sign-in</p>
          {data.audit?.map((a) => (
            <p key={a.id}>
              {a.createdAt} · {a.action}
            </p>
          ))}
        </>
      );
    return (
      <>
        <h1>Reports</h1>
        <Empty title="No reports">
          The moderation-report submission workflow is not enabled in this
          initial deployment.
        </Empty>
      </>
    );
  }
  if (section === "profile") return <ProgressProfile actor={data.actor} />;
  if (section === "sight-read")
    return <SightReadingCollection key="sight" attempts={data.sightAttempts ?? []} initialProgress={data.collectionProgress ?? {}} />;
  if (section === "practice")
    return (
      <PracticeCollection
        attempts={data.sightAttempts ?? []}
        exercises={data.practiceExercises ?? []}
        initialProgress={data.collectionProgress ?? {}}
      />
    );
  if (section === "repertoire")
    return (
      <>
        <h1>Repertoire</h1>
        <article className="panel">
          <h2>Prelude in C major · BWV 924</h2>
          <p>Johann Sebastian Bach · 18 measures · Right hand, left hand or both</p>
          <p>Main-note practice: ornament symbols are shown for reference. MIDI grading and Listen follow the main written notes.</p>
          <p><Link href="/student/practice?collection=repertoire&exercise=7005">Practise Bach’s Prelude in C</Link></p>
          <p>{[1,2,3,4].map((image,i)=><span key={image}>{i>0 && ' · '}<a href={`/scores/repertoire/bach-prelude-bwv924-source-${image}.png`} target="_blank" rel="noreferrer">Original score · image {image}</a></span>)}</p>
        </article>
        <article className="panel">
          <h2>Pop! Goes the Weasel</h2>
          <p>Traditional · Beginner · 16 measures · Right hand, left hand or both</p>
          <p><Link href="/student/practice?collection=repertoire&exercise=7004">Practise Pop! Goes the Weasel</Link></p>
          <p><a href="/scores/repertoire/pop-goes-the-weasel-source.jpg" target="_blank" rel="noreferrer">Original sheet music</a></p>
        </article>
        <article className="panel">
          <h2>Carol of the Bells</h2>
          <p>Single-staff melody · 183 measures · Right-hand MIDI practice</p>
          <p><Link href="/student/practice?collection=repertoire&exercise=7003">Practise Carol of the Bells</Link></p>
          <p><a href="/scores/repertoire/carol-page1.png" target="_blank" rel="noreferrer">Original score · page 1</a>{" · "}<a href="/scores/repertoire/carol-page2.png" target="_blank" rel="noreferrer">Page 2</a></p>
        </article>
        <div className="panel">
          <h2>Beginner Pieces</h2>
          <p>
            Ten pieces to learn at your own pace, from Hot Cross Buns and Ode to
            Joy to Reinagle’s Allegro in C Major.
          </p>
          <p>
            Read the score, listen, and practise one hand or both with your MIDI
            keyboard. Each piece includes a difficulty level and a learning
            focus.
          </p>
          <Link href="/student/practice?collection=beginner">
            Play Beginner Pieces
          </Link>
        </div>
      </>
    );
  if (section === "progress")
    return (
      <>
        <h1>Your progress</h1>
        {data.performances?.length ? (
          data.performances.map((p) => (
            <div key={p.id} className="panel">
              <strong>
                {p.score}% · {p.passed ? "Passed" : "Keep practicing"}
              </strong>
              <p>
                {new Date(p.createdAt).toLocaleString()} · {p.mode}
              </p>
            </div>
          ))
        ) : (
          <Empty title="Your progress starts here">
            Complete a MIDI activity to save your first performance.
          </Empty>
        )}
      </>
    );
  const invitation = new URLSearchParams(location.search).get("invitation");
  return (
    <>
      <h1>
        {section === "learn"
          ? "My courses"
          : `Welcome, ${data.actor.name.split(" ")[0]}`}
      </h1>
      {invitation && (
        <div className="panel">
          <h2>Teacher invitation</h2>
          <ActionButton
            label="Accept teacher invitation"
            data={{ action: "acceptInvite", token: invitation }}
            redirectTo="/student/home"
          />
        </div>
      )}
      {data.courses?.length ? (
        <div className="grid">
          {(data.courses as { enrollment: Enrollment; version: Version }[]).map(
            ({ enrollment, version }) => (
              <div key={enrollment.id} className="panel course-card">
                <span className="badge">
                  {enrollment.completedAt ? "Completed" : "Enrolled"} · Version{" "}
                  {version.number}
                </span>
                <h2>{version.metadata.title}</h2>
                <Link href={`/student/courses/${enrollment.id}`}>
                  Open course
                </Link>
              </div>
            ),
          )}
        </div>
      ) : (
        <Empty title="No courses yet">
          Your teacher can assign a course, or share an enrollment link.
        </Empty>
      )}
      {data.assignments?.map((a) => (
        <div className="panel" key={a.id}>
          <span className="badge">{a.status}</span>
          <p>{a.instructions || "Your teacher assigned a course."}</p>
        </div>
      ))}
      <div className="panel">
        <h2>Set up your piano</h2>
        <p>Connect a MIDI keyboard or try the simulator.</p>
        <Link href="/student/settings">Open MIDI setup</Link>
      </div>
    </>
  );
}
const obsMode = ["/obs", "/student/obs", "/obs/celebrations", "/obs/score", "/obs/streaks", "/obs/recording", "/obs/shorts"].includes(
  location.pathname.replace(/\/$/, ""),
);
if (obsMode) document.documentElement.classList.add("obs-mode");
if (location.pathname.replace(/\/$/, "") === "/obs/score") document.documentElement.classList.add("obs-score-mode");
createRoot(document.getElementById("root")!).render(
  obsMode ? <ObsOverlay shorts={location.pathname.replace(/\/$/, "") === "/obs/shorts"} unified={location.pathname.replace(/\/$/, "") === "/obs/recording"} streaksOnly={location.pathname.replace(/\/$/, "") === "/obs/streaks"} scoreOnly={location.pathname.replace(/\/$/, "") === "/obs/score"} celebrationsOnly={location.pathname.replace(/\/$/, "") === "/obs/celebrations"} /> : <App />,
);

function SightReadingCollection({attempts, initialProgress}: {attempts: SightAttempt[]; initialProgress: ProgressMap}) {
  const [progress, setProgress] = useState(initialProgress);
  const [, updateClock] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => updateClock(n => n + 1), 60000);
    return () => clearInterval(timer);
  }, []);
  return <SightReading attempts={attempts} progress={progress} onAttemptSaved={attempt => {
    if (attempt.progress) setProgress(previous => ({...previous, [attempt.exerciseNumber]: attempt.progress!}));
  }} />;
}

function PracticeCollection({
  attempts: initialAttempts,
  exercises,
  initialProgress,
}: {
  attempts: SightAttempt[];
  exercises: Exercise[];
  initialProgress: ProgressMap;
}) {
  const [attempts, setAttempts] = useState(initialAttempts);
  const [progress, setProgress] = useState(initialProgress);
  const [, updateClock] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => updateClock(n => n + 1), 60000);
    return () => clearInterval(timer);
  }, []);
  const attemptSaved = (attempt: SightAttempt) => {
    setAttempts(previous => [attempt, ...previous.filter(a => a.id !== attempt.id)]);
    if (attempt.progress) setProgress(previous => ({ ...previous, [attempt.exerciseNumber]: attempt.progress! }));
  };
  const [collection, setCollection] = useState(() =>
    ["repertoire", "bach", "beginner", "burgmuller", "schmitt", "classical", "moonlight", "scales"].includes(
      new URLSearchParams(location.search).get("collection") ?? "",
    )
      ? new URLSearchParams(location.search).get("collection")!
      : "hanon",
  );
  const requestedExercise = Number(new URLSearchParams(location.search).get("exercise"));
  const [selected, setSelected] = useState(
    ["repertoire", "bach"].includes(collection) && exercises.some(e => e.collection === collection && e.number === requestedExercise) ? requestedExercise :
    collection === "bach" ? 10001 : collection === "repertoire" ? 7003 : collection === "beginner"
      ? 4001
      : collection === "burgmuller"
        ? 5001
        : 3001,
  );
  const [loaded, setLoaded] = useState<Exercise>();
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const schmitt = exercises.filter((e) => e.collection === "schmitt-op16");
  const repertoire = exercises.filter((e) => e.collection === "repertoire");
  const bach = exercises.filter((e) => e.collection === "bach");
  const beginner = exercises.filter((e) => e.collection === "beginner-pieces");
  const burgmuller = exercises.filter(
    (e) => e.collection === "burgmuller-op100",
  );
  const remoteLibrary =
    collection === "bach" ? bach : collection === "repertoire" ? repertoire : collection === "beginner"
      ? beginner
      : collection === "burgmuller"
        ? burgmuller
        : burgmuller;
  const collections = [
    { id: "repertoire", title: "Repertoire", exercises: repertoire },
    { id: "bach", title: "Bach", exercises: bach },
    { id: "hanon", title: "Hanon · The Virtuoso-Pianist", exercises: practiceLibrary },
    { id: "scales", title: "Scales · C major", exercises: scalesLibrary },
    { id: "classical", title: "Classical Foundations", exercises: classicalLibrary },
    { id: "moonlight", title: "Moonlight Sonata · Learning Path", exercises: moonlightLibrary },
    { id: "beginner", title: "Beginner Pieces", exercises: beginner },
    { id: "schmitt", title: "Schmitt Op. 16", exercises: schmitt },
    { id: "burgmuller", title: "Burgmüller Op. 100", exercises: burgmuller },
  ];
  const currentCollection = collections.find(c => c.id === collection)!;
  useEffect(() => {
    if (!["repertoire", "bach", "beginner", "burgmuller"].includes(collection)) return;
    let cancelled = false;
    setLoaded(undefined);
    setLoadError("");
    void command<Exercise>({
      action: "practiceExercise",
      exerciseNumber: selected,
    })
      .then(async (ex) => {
        if (!ex.notationUrl) throw new Error("This exercise has no score.");
        const response = await fetch(ex.notationUrl);
        if (!response.ok) throw new Error("Unable to load the exercise score.");
        const notationXml = await response.text();
        if (!cancelled) setLoaded({ ...ex, notationXml });
      })
      .catch((error: Error) => {
        if (!cancelled) setLoadError(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, [collection, selected, retry]);
  return (
    <>
      <header className="practice-header">
        <h1>Practice</h1>
        <ObsLinks />
        <MidiSetup compact />
      </header>
      <ShortsCaptureControls/>
      <div className="panel practice-collection">
        <label>
          Collection
          <select
            aria-label="Practice collection"
            value={collection}
            onChange={(e) => {
              setCollection(e.target.value);
              setSelected(
                e.target.value === "bach" ? 10001 : e.target.value === "repertoire" ? 7003 : e.target.value === "beginner"
                  ? 4001
                  : e.target.value === "burgmuller"
                    ? 5001
                    : 3001,
              );
            }}
          >
            {collections.map(c => {
              const counts = collectionProgress(c.exercises, progress);
              return <option key={c.id} value={c.id} disabled={!counts.total}>{c.title} · {counts.mastered} / {counts.total} mastered</option>;
            })}
          </select>
        </label>
        <CollectionProgressView title={currentCollection.title} exercises={currentCollection.exercises} progress={progress} />
        {collection === "classical" && <small className="muted">48 exercises in 8 stages: five-finger foundations → independent hands → rhythm & harmony → accompaniment → scales → chord shapes → broken chords → early intermediate miniatures. Follow the learning path below at your own pace.</small>}
      </div>
      {["repertoire", "bach", "beginner", "burgmuller"].includes(collection) ? (
        loaded?.number === selected ? (
          <SightReading
            key={selected}
            attempts={attempts}
            onStreamReset={() => setAttempts([])}
            onAttemptSaved={attemptSaved}
            progress={progress}
            library={remoteLibrary.map((e) =>
              e.number === selected ? loaded : e,
            )}
            selectedNumber={selected}
            onSelectExercise={setSelected}
            practice
            hideHeading
          />
        ) : loadError ? (
          <div className="panel" role="alert">
            <p>{loadError}</p>
            <button onClick={() => setRetry((n) => n + 1)}>
              Retry loading exercise
            </button>
          </div>
        ) : (
          <p role="status">
            Loading {collection === "beginner" ? "piece" : "exercise"}…
          </p>
        )
      ) : (
        <SightReading
          key={collection}
          attempts={attempts}
            onStreamReset={() => setAttempts([])}
            onAttemptSaved={attemptSaved}
            progress={progress}
          library={collection === "scales" ? scalesLibrary : collection === "hanon" ? practiceLibrary : collection === "classical" ? classicalLibrary : collection === "moonlight" ? moonlightLibrary : schmitt}
          practice
          hideHeading
        />
      )}
    </>
  );
}
