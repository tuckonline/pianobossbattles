import { collectionProgress, masteryRule, progressLabels, type ProgressMap, type ProgressState } from "./collection-progress";
const order: ProgressState[] = ["mastered", "learning", "due", "notStarted"];
export function CollectionProgressView({ title, exercises, progress, reviewLabel = progressLabels.due }: { title: string; exercises: {number:number}[]; progress: ProgressMap; reviewLabel?: string }) {
  const summary = collectionProgress(exercises, progress);
  const labels = {...progressLabels, due: reviewLabel};
  return <section className="collection-progress" aria-label="Collection progress" aria-live="polite">
    <div className="collection-progress-heading"><strong>{title}</strong><span>{summary.mastered} of {summary.total} mastered ({summary.percent}%)</span></div>
    <div className="collection-mastery-meter" role="meter" aria-label="Collection mastered" aria-valuemin={0} aria-valuemax={summary.total || 1} aria-valuenow={summary.mastered} aria-valuetext={`${summary.mastered} of ${summary.total} mastered`}><span style={{width: `${summary.total ? 100 * summary.mastered / summary.total : 0}%`}} /></div>
    <p>{summary.learning} learning · {summary.due} {reviewLabel.toLowerCase()} · {summary.notStarted} not started</p>
    <details>
      <summary>Collection Progress</summary>
      <div className="collection-distribution" role="img" aria-label={order.map(s => `${summary[s]} ${labels[s]}`).join(", ")}>
        {order.map(s => <span key={s} className={`progress-${s}`} style={{width: `${summary.total ? 100 * summary[s] / summary.total : 0}%`}} />)}
      </div>
      <div className="collection-legend">{order.map(s => <span key={s}><i className={`progress-${s}`} />{summary[s]} {labels[s]}</span>)}</div>
      <p className="mastery-explanation">Mastery: {masteryRule.consecutivePasses} consecutive both-hands attempts at {masteryRule.accuracy}% accuracy or higher. Single-hand attempts count as learning and do not interrupt the both-hands sequence. Review is due {masteryRule.reviewDays} days after the last qualifying both-hands attempt once mastered.</p>
      <p className="mastery-explanation">Based on all saved practice history, including completed loop passes. Stream resets do not affect progress. Progress measures correct notes, with no timing or hold requirement. Due exercises are counted separately from currently mastered exercises.</p>
    </details>
  </section>;
}
