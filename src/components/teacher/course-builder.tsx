"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  blockTypes,
  emptyBlock,
  exerciseTypes,
  dimensions,
  type CourseTree,
  type CourseMetadata,
  type LessonBlock,
} from "@/domains/blocks/schema";
import { blockRegistry, type Asset } from "../lesson/registry";
import { LessonRenderer } from "../lesson/renderer";
import { MidiSetup } from "../midi/setup";
import { TeacherRecorder, type Recording } from "../midi/recorder";
import { command } from "../ui/actions";
import { FileUpload } from "./file-upload";
interface Version {
  id: string;
  number: number;
  revision: number;
  tree: CourseTree;
  metadata: CourseMetadata;
  status: string;
}
export function CreateCourse() {
  const [title, setTitle] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <form
      className="inline-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const c = await command<{ id: string }>({
            action: "createCourse",
            title,
          });
          router.push(`/teacher/courses/${c.id}`);
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        New course title
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="Course title"
        />
      </label>
      <button disabled={busy}>Create course</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
export function CourseBuilder({
  courseId,
  initialVersion,
  initialVisibility,
  initialRecordings,
  assets: initialAssets,
  canPublish,
  fileUploads = false,
}: {
  courseId: string;
  initialVersion: Version;
  initialVisibility: "PRIVATE" | "UNLISTED" | "PUBLIC";
  initialRecordings: Recording[];
  assets: Asset[];
  canPublish: boolean;
  fileUploads?: boolean;
}) {
  const [version, setVersion] = useState(initialVersion),
    [tree, setTree] = useState(initialVersion.tree),
    [metadata, setMetadata] = useState(initialVersion.metadata),
    [visibility, setVisibility] = useState(initialVisibility),
    [selected, setSelected] = useState(
      initialVersion.tree.modules[0]?.lessons[0]?.id ?? "",
    ),
    [recordings, setRecordings] = useState(initialRecordings),
    [assets, setAssets] = useState(initialAssets),
    [uploadCount, setUploadCount] = useState(0),
    [preview, setPreview] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [type, setType] = useState<LessonBlock["type"]>("TEXT");
  const lesson = tree.modules
    .flatMap((m) => m.lessons)
    .find((l) => l.id === selected);
  const change = (next: CourseTree) => {
    setTree(next);
    setDirty(true);
  };
  const updateLesson = (
    fn: (l: NonNullable<typeof lesson>) => NonNullable<typeof lesson>,
  ) => {
    setDirty(true);
    setTree((current) => ({
      ...current,
      modules: current.modules.map((m) => ({
        ...m,
        lessons: m.lessons.map((l) => (l.id === selected ? fn(l) : l)),
      })),
    }));
  };
  const move = <T,>(items: T[], index: number, delta: number) => {
    const copy = [...items];
    if (index + delta < 0 || index + delta >= copy.length) return copy;
    [copy[index], copy[index + delta]] = [copy[index + delta], copy[index]];
    return copy;
  };
  const updateBlock = (block: LessonBlock) =>
    updateLesson((l) => ({
      ...l,
      blocks: l.blocks.map((b) => (b.id === block.id ? block : b)),
    }));
  const save = async () => {
    const v = await command<Version>({
      action: "saveDraft",
      courseId,
      versionId: version.id,
      revision: version.revision,
      tree,
      metadata,
      visibility,
    });
    setVersion(v);
    setDirty(false);
    return v;
  };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (preview && lesson)
    return (
      <>
        <div className="page-head">
          <p className="badge">Student preview · unsaved changes included</p>
          <button className="secondary" onClick={() => setPreview(false)}>
            Return to editor
          </button>
        </div>
        <LessonRenderer
          key={lesson.id}
          lesson={lesson}
          recordings={recordings}
          assets={assets}
        />
      </>
    );
  if (version.status === "PUBLISHED")
    return (
      <>
        <h1>{metadata.title}</h1>
        <p>
          Version {version.number} is published. Existing students keep this
          version when you publish an update.
        </p>
        <button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const v = await command<Version>({
                action: "newDraft",
                courseId,
              });
              setVersion(v);
              setTree(v.tree);
              setMetadata(v.metadata);
              setMessage("New draft created.");
            })
          }
        >
          Create next draft
        </button>
        <p role="status">{message}</p>
      </>
    );
  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Course builder · version {version.number}</p>
          <h1>{metadata.title}</h1>
          <span className="badge">
            Draft · {dirty ? "unsaved changes" : "saved"}
          </span>
        </div>
        <div className="row">
          <button
            className="secondary"
            disabled={!lesson || busy || uploadCount > 0}
            onClick={() => setPreview(true)}
          >
            Preview as student
          </button>
          <button
            disabled={busy || uploadCount > 0}
            onClick={() =>
              void run(async () => {
                await save();
                setMessage("Draft saved.");
              })
            }
          >
            Save draft
          </button>
          {canPublish && (
            <button
              disabled={busy || uploadCount > 0}
              onClick={() =>
                void run(async () => {
                  const v = await save();
                  await command({
                    action: "publish",
                    courseId,
                    versionId: v.id,
                    revision: v.revision,
                  });
                  setVersion({ ...v, status: "PUBLISHED" });
                  setMessage("Course published.");
                })
              }
            >
              Publish course
            </button>
          )}
        </div>
      </header>
      <p role="status" className="notice" hidden={!message}>
        {message}
      </p>
      <details className="panel">
        <summary>Course details, access and rights</summary>
        <div className="stack spacer">
          <label>
            Course title
            <input
              value={metadata.title}
              onChange={(e) => {
                setMetadata({ ...metadata, title: e.target.value });
                setDirty(true);
              }}
            />
          </label>
          <label>
            Description
            <textarea
              value={metadata.description}
              onChange={(e) => {
                setMetadata({ ...metadata, description: e.target.value });
                setDirty(true);
              }}
            />
          </label>
          <div className="row">
            <label>
              Level
              <input
                value={metadata.level}
                onChange={(e) => {
                  setMetadata({ ...metadata, level: e.target.value });
                  setDirty(true);
                }}
              />
            </label>
            <label>
              Language
              <input
                value={metadata.language}
                onChange={(e) => {
                  setMetadata({ ...metadata, language: e.target.value });
                  setDirty(true);
                }}
              />
            </label>
            <label>
              Visibility
              <select
                value={visibility}
                onChange={(e) => {
                  setVisibility(e.target.value as typeof visibility);
                  setDirty(true);
                }}
              >
                <option>PRIVATE</option>
                <option>UNLISTED</option>
                <option>PUBLIC</option>
              </select>
            </label>
            <label>
              Enrollment policy
              <select
                value={metadata.accessPolicy}
                onChange={(e) => {
                  setMetadata({
                    ...metadata,
                    accessPolicy: e.target
                      .value as CourseMetadata["accessPolicy"],
                  });
                  setDirty(true);
                }}
              >
                <option value="FREE">Free enrollment</option>
                <option value="GRANT_REQUIRED">
                  Teacher must grant access
                </option>
              </select>
            </label>
          </div>
          <label>
            Rights declaration
            <select
              value={metadata.rights.status}
              onChange={(e) => {
                setMetadata({
                  ...metadata,
                  rights: {
                    ...metadata.rights,
                    status: e.target
                      .value as CourseMetadata["rights"]["status"],
                  },
                });
                setDirty(true);
              }}
            >
              {[
                "UNKNOWN",
                "ORIGINAL",
                "PUBLIC_DOMAIN",
                "LICENSED",
                "PERMISSION_GRANTED",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Rights owner
            <input
              value={metadata.rights.owner}
              onChange={(e) => {
                setMetadata({
                  ...metadata,
                  rights: { ...metadata.rights, owner: e.target.value },
                });
                setDirty(true);
              }}
            />
          </label>
          <label>
            License notes
            <textarea
              value={metadata.rights.notes}
              onChange={(e) => {
                setMetadata({
                  ...metadata,
                  rights: { ...metadata.rights, notes: e.target.value },
                });
                setDirty(true);
              }}
            />
          </label>
        </div>
      </details>
      <div className="builder">
        <section className="outline" aria-label="Course outline">
          <h2>Course outline</h2>
          {tree.modules.map((module, mi) => (
            <div key={module.id} className="panel">
              <label>
                Module title
                <input
                  value={module.title}
                  onChange={(e) =>
                    change({
                      ...tree,
                      modules: tree.modules.map((m) =>
                        m.id === module.id
                          ? { ...m, title: e.target.value }
                          : m,
                      ),
                    })
                  }
                />
              </label>
              <div className="row">
                <button
                  className="quiet"
                  aria-label={`Move module ${mi + 1} up`}
                  disabled={mi === 0}
                  onClick={() =>
                    change({ ...tree, modules: move(tree.modules, mi, -1) })
                  }
                >
                  ↑
                </button>
                <button
                  className="quiet"
                  aria-label={`Move module ${mi + 1} down`}
                  disabled={mi === tree.modules.length - 1}
                  onClick={() =>
                    change({ ...tree, modules: move(tree.modules, mi, 1) })
                  }
                >
                  ↓
                </button>
              </div>
              {module.lessons.map((l, li) => (
                <div key={l.id}>
                  <button
                    className={`lesson-select secondary ${l.id === selected ? "selected" : ""}`}
                    onClick={() => setSelected(l.id)}
                  >
                    {l.title}
                  </button>
                  <div className="row">
                    <button
                      className="quiet"
                      aria-label={`Move lesson ${li + 1} up`}
                      disabled={li === 0}
                      onClick={() =>
                        change({
                          ...tree,
                          modules: tree.modules.map((m) =>
                            m.id === module.id
                              ? { ...m, lessons: move(m.lessons, li, -1) }
                              : m,
                          ),
                        })
                      }
                    >
                      ↑
                    </button>
                    <button
                      className="quiet"
                      aria-label={`Move lesson ${li + 1} down`}
                      disabled={li === module.lessons.length - 1}
                      onClick={() =>
                        change({
                          ...tree,
                          modules: tree.modules.map((m) =>
                            m.id === module.id
                              ? { ...m, lessons: move(m.lessons, li, 1) }
                              : m,
                          ),
                        })
                      }
                    >
                      ↓
                    </button>
                  </div>
                </div>
              ))}
              <button
                className="secondary spacer"
                onClick={() => {
                  const id = crypto.randomUUID();
                  change({
                    ...tree,
                    modules: tree.modules.map((m) =>
                      m.id === module.id
                        ? {
                            ...m,
                            lessons: [
                              ...m.lessons,
                              { id, title: "Untitled lesson", blocks: [] },
                            ],
                          }
                        : m,
                    ),
                  });
                  setSelected(id);
                }}
              >
                Add lesson
              </button>
            </div>
          ))}
          <button
            className="secondary"
            onClick={() =>
              change({
                ...tree,
                modules: [
                  ...tree.modules,
                  {
                    id: crypto.randomUUID(),
                    title: "Untitled module",
                    lessons: [],
                  },
                ],
              })
            }
          >
            Add module
          </button>
        </section>
        <section>
          {lesson ? (
            <>
              <div className="row">
                <label>
                  Lesson title
                  <input
                    value={lesson.title}
                    onChange={(e) =>
                      updateLesson((l) => ({ ...l, title: e.target.value }))
                    }
                  />
                </label>
                <button
                  className="quiet"
                  onClick={() => {
                    const duplicate = {
                      ...structuredClone(lesson),
                      id: crypto.randomUUID(),
                      title: `${lesson.title} (copy)`,
                      blocks: lesson.blocks.map((b) => ({
                        ...structuredClone(b),
                        id: crypto.randomUUID(),
                      })),
                    };
                    change({
                      ...tree,
                      modules: tree.modules.map((m) =>
                        m.lessons.some((l) => l.id === selected)
                          ? { ...m, lessons: [...m.lessons, duplicate] }
                          : m,
                      ),
                    });
                    setSelected(duplicate.id);
                  }}
                >
                  Duplicate lesson
                </button>
                <button
                  className="danger"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Remove this lesson from the draft? Published versions remain available.",
                      )
                    ) {
                      change({
                        ...tree,
                        modules: tree.modules.map((m) => ({
                          ...m,
                          lessons: m.lessons.filter((l) => l.id !== selected),
                        })),
                      });
                      setSelected("");
                    }
                  }}
                >
                  Delete lesson
                </button>
              </div>
              {lesson.blocks.some((b) => b.type.startsWith("MIDI")) && (
                <div className="spacer">
                  <MidiSetup />
                </div>
              )}
              {lesson.blocks.map((block, index) => {
                const Editor = blockRegistry[block.type].TeacherEditorComponent;
                return (
                  <div className="block" key={block.id}>
                    <div className="block-tools">
                      <strong>{block.type.replaceAll("_", " ")}</strong>
                      <div className="row">
                        <button
                          className="quiet"
                          aria-label={`Move block ${index + 1} up`}
                          disabled={index === 0}
                          onClick={() =>
                            updateLesson((l) => ({
                              ...l,
                              blocks: move(l.blocks, index, -1),
                            }))
                          }
                        >
                          ↑
                        </button>
                        <button
                          className="quiet"
                          aria-label={`Move block ${index + 1} down`}
                          disabled={index === lesson.blocks.length - 1}
                          onClick={() =>
                            updateLesson((l) => ({
                              ...l,
                              blocks: move(l.blocks, index, 1),
                            }))
                          }
                        >
                          ↓
                        </button>
                        <button
                          className="quiet"
                          onClick={() =>
                            updateLesson((l) => ({
                              ...l,
                              blocks: l.blocks.filter((b) => b.id !== block.id),
                            }))
                          }
                        >
                          Remove block
                        </button>
                      </div>
                    </div>
                    <Editor
                      block={block}
                      onChange={updateBlock}
                      assets={assets}
                    />
                    {fileUploads &&
                      (["VIDEO", "AUDIO"].includes(block.type) ||
                        "recordingId" in block.config) && (
                        <FileUpload
                          courseId={courseId}
                          kind={
                            block.type === "VIDEO"
                              ? "VIDEO"
                              : block.type === "AUDIO"
                                ? "AUDIO"
                                : "MIDI"
                          }
                          rights={metadata.rights}
                          onBusy={(active) =>
                            setUploadCount((n) => n + (active ? 1 : -1))
                          }
                          onUploaded={({ asset, recording }) => {
                            setAssets((items) => [...items, asset]);
                            if (recording)
                              setRecordings((items) => [...items, recording]);
                            updateLesson((l) => ({
                              ...l,
                              blocks: l.blocks.map((b) =>
                                b.id !== block.id
                                  ? b
                                  : ({
                                      ...b,
                                      config: {
                                        ...b.config,
                                        ...(recording
                                          ? { recordingId: recording.id }
                                          : { assetId: asset.id }),
                                      },
                                    } as LessonBlock),
                              ),
                            }));
                          }}
                        />
                      )}
                    {"recordingId" in block.config && (
                      <MidiBlockEditor
                        block={
                          block as Extract<
                            LessonBlock,
                            { type: "MIDI_EXERCISE" | "MIDI_DEMONSTRATION" }
                          >
                        }
                        recordings={recordings}
                        onChange={updateBlock}
                        onRecording={(r) => {
                          setRecordings([...recordings, r]);
                          updateBlock({
                            ...block,
                            config: { ...block.config, recordingId: r.id },
                          } as LessonBlock);
                        }}
                      />
                    )}
                  </div>
                );
              })}
              <div className="row panel">
                <label>
                  Block type
                  <select
                    value={type}
                    onChange={(e) =>
                      setType(e.target.value as LessonBlock["type"])
                    }
                  >
                    {blockTypes.map((t) => (
                      <option key={t} value={t}>
                        {t.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  onClick={() =>
                    updateLesson((l) => ({
                      ...l,
                      blocks: [...l.blocks, emptyBlock(type)],
                    }))
                  }
                >
                  Add block
                </button>
              </div>
            </>
          ) : (
            <div className="empty">
              <h2>Build your course outline</h2>
              <p>Add a module and a lesson to start authoring.</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
function MidiBlockEditor({
  block,
  recordings,
  onChange,
  onRecording,
}: {
  block: Extract<LessonBlock, { type: "MIDI_EXERCISE" | "MIDI_DEMONSTRATION" }>;
  recordings: Recording[];
  onChange: (b: LessonBlock) => void;
  onRecording: (r: Recording) => void;
}) {
  const config = block.config;
  return (
    <div className="stack">
      <label>
        Recording
        <select
          value={config.recordingId}
          onChange={(e) =>
            onChange({
              ...block,
              config: { ...config, recordingId: e.target.value },
            })
          }
        >
          <option value="">Record or select an example</option>
          {recordings.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
        </select>
      </label>
      <details>
        <summary>Record a new example</summary>
        <TeacherRecorder onSaved={onRecording} />
      </details>
      <label>
        Interaction template
        <select
          value={config.template}
          onChange={(e) =>
            onChange({
              ...block,
              config: {
                ...config,
                template: e.target.value as typeof config.template,
              },
            })
          }
        >
          {exerciseTypes.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend>Evaluate these dimensions</legend>
        <div className="row">
          {dimensions.map((d) => (
            <label key={d} className="check">
              <input
                type="checkbox"
                checked={config.scoring.weights[d] > 0}
                onChange={(e) =>
                  onChange({
                    ...block,
                    config: {
                      ...config,
                      scoring: {
                        ...config.scoring,
                        weights: {
                          ...config.scoring.weights,
                          [d]: e.target.checked ? 1 : 0,
                        },
                      },
                    },
                  })
                }
              />
              {d}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="row">
        <label>
          Timing tolerance
          <select
            value={config.scoring.onsetTolerance}
            onChange={(e) =>
              onChange({
                ...block,
                config: {
                  ...config,
                  scoring: {
                    ...config.scoring,
                    onsetTolerance: Number(e.target.value),
                  },
                },
              })
            }
          >
            <option value={250}>Beginner</option>
            <option value={150}>Moderate</option>
            <option value={70}>Strict</option>
          </select>
        </label>
        {(["passingScore", "minimumTempo", "targetTempo"] as const).map(
          (key) => (
            <label key={key}>
              {key === "passingScore"
                ? "Passing score"
                : key === "minimumTempo"
                  ? "Minimum tempo"
                  : "Target tempo"}
              <input
                type="number"
                min={1}
                max={key === "passingScore" ? 100 : 300}
                value={config.scoring[key]}
                onChange={(e) =>
                  onChange({
                    ...block,
                    config: {
                      ...config,
                      scoring: {
                        ...config.scoring,
                        [key]: Number(e.target.value),
                      },
                    },
                  })
                }
              />
            </label>
          ),
        )}
      </div>
    </div>
  );
}
