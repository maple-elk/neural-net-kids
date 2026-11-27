import { lazy, Suspense } from 'react'
import { LearningProvider, useLearning } from './context/LearningContext.jsx'
import Layout from './components/Layout.jsx'
import HomePathway from './components/HomePathway.jsx'

const NeuronLab = lazy(() => import('./labs/NeuronLab.jsx'))
const LearningLab = lazy(() => import('./labs/LearningLab.jsx'))
const PlaygroundLab = lazy(() => import('./labs/PlaygroundLab.jsx'))
const VisionLab = lazy(() => import('./labs/VisionLab.jsx'))
const TokensVectorsLab = lazy(() => import('./labs/TokensVectorsLab.jsx'))
const AttentionLab = lazy(() => import('./labs/AttentionLab.jsx'))
const MiniLlmLab = lazy(() => import('./labs/MiniLlmLab.jsx'))
const HistoryLab = lazy(() => import('./labs/HistoryLab.jsx'))

const STAGE_COMPONENTS = {
  1: NeuronLab,
  2: LearningLab,
  3: PlaygroundLab,
  4: VisionLab,
  5: TokensVectorsLab,
  6: AttentionLab,
  7: MiniLlmLab,
  8: HistoryLab,
}

function LabLoadingFallback() {
  return (
    <div className="lab-card" role="status" aria-live="polite" style={{ textAlign: 'center', padding: '48px 24px', maxWidth: 860, margin: '0 auto' }}>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', color: 'var(--text-secondary)' }}>
        Opening chapter...
      </p>
    </div>
  )
}

function AppRouter() {
  const { currentStageId } = useLearning()
  const StageComponent = currentStageId ? STAGE_COMPONENTS[currentStageId] : null

  return (
    <Layout>
      {StageComponent ? (
        <Suspense fallback={<LabLoadingFallback />}>
          <StageComponent />
        </Suspense>
      ) : (
        <HomePathway />
      )}
    </Layout>
  )
}

export default function App() {
  return (
    <LearningProvider>
      <AppRouter />
    </LearningProvider>
  )
}
