import { useCallback, useEffect, useRef, useState } from "react";
import { platformRequest } from "../src/lib/platform-request";
import { hasMusicAccess, type MusicCatalogItem } from "../src/domains/economy/music-catalog";
import { goldRules, type EconomySnapshot } from "../src/domains/economy/rewards";
import { musicalTiers } from "../src/domains/music-generator/difficulty-profiles";
import type { Exercise } from "../hosted/sight-library";
import { NotationViewer } from "../src/components/music/notation";
import { ClassicalPractice } from "./classical-practice";
import { collectionName } from "./music-labels";
import "./music-room.css";

type RoomResponse = { economy?: EconomySnapshot; catalog?: MusicCatalogItem[]; exercise?: Exercise; xml?: string; charged?: number };
export function useMusicRoom(userId: string) {
  const [economy, setEconomy] = useState<EconomySnapshot>();
  const [catalog, setCatalog] = useState<MusicCatalogItem[]>([]), [error, setError] = useState("");
  const accept = useCallback((next?: EconomySnapshot) => {
    if (next) setEconomy(old => !old || next.revision >= old.revision ? next : old);
  }, []);
  const request = useCallback(async (input: Record<string, unknown>) => {
    const response = await platformRequest({ ...input, expectedUserId: userId }, "/api/music-room");
    const data = await response.json();
    if (!response.ok) throw Error(data.error ?? "The music archive is unavailable. Please retry.");
    accept(data.economy);
    return data as RoomResponse;
  }, [userId, accept]);
  const refresh = useCallback(async () => {
    try { const data = await request({ action: "state" }); setCatalog(data.catalog ?? []); setError(""); }
    catch (e) { setError((e as Error).message); }
  }, [request]);
  useEffect(() => { void refresh(); const online = () => void refresh(); window.addEventListener("online", online); return () => window.removeEventListener("online", online); }, [refresh]);
  return { userId, economy, catalog, error, refresh, request, accept };
}
export type MusicRoomState = ReturnType<typeof useMusicRoom>;
const difficulty = (item: MusicCatalogItem) => item.difficulty ? musicalTiers[item.difficulty - 1].name : item.difficultyLabel ?? "All levels";
function MusicDetails({ item }: { item: MusicCatalogItem }) {
  return <><h2>{item.title}</h2><p>{item.composer ?? "Piano exercise"}</p><p className="music-meta">{difficulty(item)}{item.key && ` · ${item.key}`}{item.tempo && ` · ${item.tempo} BPM`}</p></>;
}

export function RoyalMusicShop({ room, onPractice }: { room: MusicRoomState; onPractice: (id: string) => void }) {
  const [preview, setPreview] = useState<{ item: MusicCatalogItem; xml: string }>();
  const [busy, setBusy] = useState(""), [message, setMessage] = useState(""), [error, setError] = useState("");
  const flight = useRef(false), purchaseIds = useRef(new Map<string, string>()), previewRequest = useRef(0);
  const buy = async (item: MusicCatalogItem) => {
    if (flight.current) return;
    flight.current = true; setBusy(item.id); setError(""); setMessage("");
    const transactionId = purchaseIds.current.get(item.id) ?? crypto.randomUUID();
    purchaseIds.current.set(item.id, transactionId);
    try { const saved = await room.request({ action: "purchase", itemId: item.id, transactionId });
      setMessage(`${item.title} is yours. ${saved.charged ? `${saved.charged} gold spent. ` : ""}Ready in Practice Studio.`);
    } catch (e) { setError((e as Error).message); }
    finally { flight.current = false; setBusy(""); }
  };
  const showPreview = async (item: MusicCatalogItem) => {
    const sequence = ++previewRequest.current; setError("");
    try { const data = await room.request({ action: "preview", itemId: item.id }); if (sequence === previewRequest.current) setPreview({ item, xml: data.xml! }); }
    catch (e) { if (sequence === previewRequest.current) setError((e as Error).message); }
  };
  return <section className="music-room" aria-label="Royal Music Shop">
    <header><span className="realm-eyebrow">YOUR MUSIC COLLECTION</span><h1>Music Shop</h1><p>Turn your practice into a growing collection. Every purchase is permanent.</p></header>
    <p className="music-gold">{room.economy?.gold ?? "—"} gold available</p>
    <p>Active MIDI practice earns about {goldRules.goldPerHour} gold per hour in lessons, guided sessions, and free practice. Songs generally cost 100–500 gold (2–10 hours). Essential learning exercises stay free.</p>
    <p className="music-message" role="status">{message}</p>{error && <p role="alert">{error}</p>}
    <div className="music-grid">{room.catalog.filter(i => i.accessType === "purchasable").map(item => {
      const owned = hasMusicAccess(item, room.economy?.owned ?? [], room.userId);
      return <article className="music-card" key={item.id}><MusicDetails item={item}/>
        <strong className="music-price">{owned ? "Owned" : `${item.goldPrice} gold`}</strong>
        {!owned && <small>About {item.goldPrice! / goldRules.goldPerHour} hours of active practice</small>}
        <div className="music-actions"><button onClick={() => void showPreview(item)}>Preview {item.title}</button>
          {owned ? <button className="primary" onClick={() => onPractice(item.id)}>Practice</button> : <button className="primary" disabled={!!busy || !room.economy || room.economy.gold < item.goldPrice!} onClick={() => void buy(item)}>{busy === item.id ? "Purchasing…" : `Buy for ${item.goldPrice} gold`}</button>}
        </div>{!owned && room.economy && room.economy.gold < item.goldPrice! && <small>Earn {item.goldPrice! - room.economy.gold} more gold through piano practice.</small>}
      </article>;
    })}</div>
    {preview && <section className="music-preview" aria-label="Music preview"><button onClick={() => { previewRequest.current++; setPreview(undefined); }}>Close preview</button><MusicDetails item={preview.item}/><p>Opening two measures · full practice unlocks with ownership.</p><div className="classical-score"><NotationViewer xml={preview.xml} compact displaySize={{ zoom: 1.4, fitWidth: true }} hideTitle/></div>{preview.item.sourceUrl && <a href={preview.item.sourceUrl} target="_blank" rel="noreferrer">Edition and public-domain source</a>}</section>}
  </section>;
}

export function PracticeStudio({ room, connected, selectedId, onClosePiece, onOpenPiece, onGenerate }: {
  room: MusicRoomState; connected: boolean; selectedId?: string; onClosePiece: () => void; onOpenPiece: (id: string) => void; onGenerate: () => void;
}) {
  const [filter, setFilter] = useState("all"), [search, setSearch] = useState("");
  const [piece, setPiece] = useState<{ id: string; exercise: Exercise }>(), [error, setError] = useState("");
  const request = room.request;
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    void request({ action: "exercise", itemId: selectedId }).then(data => { if (!cancelled) { setPiece({ id: selectedId, exercise: data.exercise! }); setError(""); } }).catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [selectedId, request]);
  if (selectedId) return piece?.id === selectedId
    ? <ClassicalPractice key={selectedId} piece={piece.exercise} pieceDifficulty={room.catalog.find(item => item.id === selectedId)?.difficulty} connected={connected} onClose={onClosePiece}/>
    : <section className="music-room"><button onClick={onClosePiece}>Back to Studio</button><p role={error ? "alert" : "status"}>{error || "Opening your sheet music…"}</p></section>;
  const available = room.catalog.filter(i => hasMusicAccess(i, room.economy?.owned ?? [], room.userId));
  const items = available.filter(i => (filter === "all" || (filter === "owned" ? i.accessType === "purchasable" : i.category === filter)) && `${i.title} ${i.composer ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="music-room" aria-label="Practice Studio"><header><span className="realm-eyebrow">YOUR MUSIC, YOUR PACE</span><h1>Music Library</h1><p>Starter music, your existing exercises, and every piece you unlock.</p></header>
    <div className="music-filters"><label>Find music<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Title or composer"/></label><label>Collection<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All music</option><option value="song">Songs</option><option value="exercise">Exercises</option><option value="owned">Purchased repertoire</option></select></label><button onClick={onGenerate}>Infinite Classical Practice</button></div>
    <p>{items.length} pieces available · Studio practice is self-paced and does not award official realm stars.</p>
    <div className="music-grid">{items.map(item => <article className="music-card" key={item.id}><small>{item.accessType === "purchasable" ? "Owned" : item.accessType === "starter" ? "Starter · Included" : `${collectionName(item.collection)} · Included`}</small><MusicDetails item={item}/><button className="primary" onClick={() => onOpenPiece(item.id)}>Practice {item.title}</button></article>)}</div>
    {!items.length && <p>No matching pieces. Try another filter or visit the Royal Music Shop.</p>}
  </section>;
}
