import { ArrowLeft, ArrowRight, CheckCircle2, Sparkles } from 'lucide-react'
import { useLearning } from '../context/LearningContext.jsx'
import { getStageById, STAGES } from '../utils/pathwayLoader.js'

export default function LabPlaceholder({ stageId }) {
  const { isDeepDive, completedStages, markStageComplete, navigate } = useLearning()
  const stage = getStageById(stageId)

  if (!stage) {
    return (
      <div className="lab-card">
        <h2>Stage not found</h2>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/')}>
          Back to Pathway
        </button>
      </div>
    )
  }

  const isDone = completedStages.has(stage.id)
  const prevStage = STAGES.find((s) => s.id === stage.id - 1)
  const nextStage = STAGES.find((s) => s.id === stage.id + 1)

  return (
    <div className="lab-page">
      <header className="lab-header" style={{ '--stage-accent': stage.color }}>
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
          <h1>{stage.title}</h1>
          <p className="stage-card-subtitle">{stage.subtitle}</p>
        </div>

        <button
          type="button"
          className={`btn ${isDone ? 'btn-success' : 'btn-secondary'}`}
          onClick={() => markStageComplete(stage.id)}
        >
          <CheckCircle2 size={16} />
          <span>{isDone ? 'Stage Completed' : 'Mark Complete'}</span>
        </button>
      </header>

      <section className="lab-card">
        <div className={isDeepDive ? 'callout-deep' : 'callout-kid'} style={{ marginBottom: 16 }}>
          <strong>{isDeepDive ? 'Deep-Dive Overview: ' : 'Explorer Overview: '}</strong>
          {isDeepDive ? stage.deepDiveSummary : stage.kidSummary}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: '0.92rem' }}>
          <Sparkles size={16} color={stage.color} />
          <span>Interactive lab module for Stage {stage.id} is ready to be mounted here.</span>
        </div>
      </section>

      <nav className="lab-footer-nav" aria-label="Stage navigation">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => navigate(prevStage ? prevStage.route : '/')}
        >
          <ArrowLeft size={16} />
          <span>{prevStage ? `Stage ${prevStage.id}: ${prevStage.title}` : 'Back to Pathway'}</span>
        </button>

        {nextStage ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate(nextStage.route)}
          >
            <span>Next: {nextStage.title}</span>
            <ArrowRight size={16} />
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => navigate('/')}>
            <span>Back to Pathway Map</span>
            <ArrowRight size={16} />
          </button>
        )}
      </nav>
    </div>
  )
}
