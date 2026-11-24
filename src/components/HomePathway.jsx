import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Compass,
  Eye,
  FlaskConical,
  MessageSquare,
  Network,
  Play,
  Sparkles,
  TrendingDown,
  Zap,
} from 'lucide-react'
import { useLearning } from '../context/LearningContext.jsx'
import { PATHWAY_META, STAGES } from '../utils/pathwayLoader.js'

const ICON_MAP = {
  Zap,
  Network,
  TrendingDown,
  Eye,
  Sparkles,
  MessageSquare,
  Clock,
}

function StageIcon({ name, size = 20 }) {
  const Icon = ICON_MAP[name] || Sparkles
  return <Icon size={size} strokeWidth={2.2} />
}

export default function HomePathway() {
  const { mode, isDeepDive, setMode, completedStages, navigate } = useLearning()

  const completedCount = completedStages.size
  const totalStages = STAGES.length
  const progressPct = Math.round((completedCount / Math.max(totalStages, 1)) * 100)

  const nextStage = STAGES.find((stage) => !completedStages.has(stage.id)) || STAGES[0]

  return (
    <div className="pathway-page">
      <section className="pathway-hero" aria-label="Welcome">
        <div>
          <div className="pathway-hero-eyebrow">
            <Sparkles size={14} />
            <span>Interactive STEM Lab · 100% In-Browser</span>
          </div>

          <h1>
            How Does AI <span className="pathway-hero-accent">Actually Think?</span>
          </h1>

          <p className="pathway-hero-lead">
            {isDeepDive
              ? 'Step through 7 interactive labs—from a single perceptron and backpropagation to convolutional filters, vector embeddings, self-attention, and an in-browser language model.'
              : PATHWAY_META.tagline ||
                'Play with 7 hands-on experiments that take you from one tiny artificial neuron all the way to training your own Mini-LLM!'}
          </p>

          <div className="pathway-hero-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate(nextStage.route)}
            >
              <Play size={16} />
              <span>
                {completedCount === 0
                  ? 'Start Stage 1: Meet the Neuron'
                  : completedCount === totalStages
                    ? 'Replay Stage 1'
                    : `Continue Stage ${nextStage.id}: ${nextStage.title}`}
              </span>
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setMode(isDeepDive ? 'explorer' : 'deep-dive')}
            >
              {isDeepDive ? <Compass size={16} /> : <FlaskConical size={16} />}
              <span>
                {isDeepDive ? 'Switch to Explorer Mode' : 'Try Deep-Dive Mode'}
              </span>
            </button>
          </div>
        </div>

        <aside className="pathway-progress-card" aria-label="Your lab progress">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontFamily: 'var(--font-display)', fontSize: '1.08rem' }}>
              Your Learning Pathway
            </strong>
            <span className={`badge ${isDeepDive ? 'badge-deep' : 'badge-explorer'}`}>
              {mode === 'deep-dive' ? 'Deep-Dive Mode' : 'Explorer Mode'}
            </span>
          </div>

          <div className="progress-bar-track" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
            <div className="progress-bar-fill" style={{ width: `${progressPct}%` }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
            <span>
              <strong>{completedCount}</strong> of <strong>{totalStages}</strong> labs completed
            </span>
            <span className="font-mono" style={{ fontWeight: 600 }}>
              {progressPct}%
            </span>
          </div>

          <div className={isDeepDive ? 'callout-deep' : 'callout-kid'} style={{ fontSize: '0.84rem', padding: '10px 12px' }}>
            {isDeepDive
              ? 'Deep-Dive is ON: labs reveal exact equations, weight matrices, gradients, and sampling math.'
              : 'Explorer Mode is ON: clear everyday metaphors & hands-on puzzles. Toggle Deep-Dive anytime to peek at the math!'}
          </div>
        </aside>
      </section>

      <section aria-label="7-stage learning pathway">
        <div className="pathway-section-head">
          <div>
            <h2>7 Escalating Labs</h2>
            <p>Each stage builds directly on the last — or jump straight into any experiment.</p>
          </div>
        </div>

        <div className="pathway-track">
          {STAGES.map((stage) => {
            const isDone = completedStages.has(stage.id)
            const summary = isDeepDive ? stage.deepDiveSummary : stage.kidSummary

            return (
              <article key={stage.id} className="pathway-row">
                <div className="pathway-node-col">
                  <div
                    className="pathway-node"
                    style={{ background: stage.color }}
                    aria-hidden="true"
                  >
                    <StageIcon name={stage.icon} size={20} />
                    <span className="pathway-node-num">0{stage.id}</span>
                  </div>
                </div>

                <div
                  className="stage-card"
                  style={{ '--stage-accent': stage.color }}
                >
                  <div className="stage-card-top">
                    <div>
                      <div className="stage-card-badges">
                        <span
                          className="badge"
                          style={{
                            background: `${stage.color}1a`,
                            color: stage.color,
                            border: `1px solid ${stage.color}44`,
                          }}
                        >
                          Stage {stage.id} · {stage.level}
                        </span>
                        <span className="badge badge-subtle">{stage.ageBadge}</span>
                        {isDone && (
                          <span className="badge badge-success">
                            <CheckCircle2 size={13} />
                            Completed
                          </span>
                        )}
                      </div>

                      <h3 className="stage-card-title">{stage.title}</h3>
                      <p className="stage-card-subtitle">{stage.subtitle}</p>
                    </div>

                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{
                        background: stage.color,
                        boxShadow: `0 4px 12px ${stage.color}40`,
                      }}
                      onClick={() => navigate(stage.route)}
                    >
                      <span>{isDone ? 'Revisit Lab' : 'Open Lab'}</span>
                      <ArrowRight size={15} />
                    </button>
                  </div>

                  <p className="stage-card-summary">{summary}</p>

                  {Array.isArray(stage.interactiveHighlights) && stage.interactiveHighlights.length > 0 && (
                    <div className="stage-highlights">
                      {stage.interactiveHighlights.map((item) => (
                        <span key={item} className="stage-highlight-chip">
                          <Sparkles size={12} color={stage.color} />
                          {item}
                        </span>
                      ))}
                    </div>
                  )}

                  {Array.isArray(stage.keyConcepts) && stage.keyConcepts.length > 0 && (
                    <div className="stage-card-footer">
                      <div className="stage-concepts-preview">
                        <span style={{ fontWeight: 600 }}>Key ideas:</span>
                        {stage.keyConcepts.map((c) => (
                          <span key={c.term} className="concept-tag">
                            {c.term}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}
