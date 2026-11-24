import { lazy, Suspense } from 'react'
import { LearningProvider, useLearning } from './context/LearningContext.jsx'
import Layout from './components/Layout.jsx'
import HomePathway from './components/HomePathway.jsx'

const NeuronLab = lazy(() => import('./labs/NeuronLab.jsx'))
const PlaygroundLab = lazy(() => import('./labs/PlaygroundLab.jsx'))
const BackpropLab = lazy(() => import('./labs/BackpropLab.jsx'))
const VisionLab = lazy(() => import('./labs/VisionLab.jsx'))
const LanguageLab = lazy(() => import('./labs/LanguageLab.jsx'))
const MiniLlmLab = lazy(() => import('./labs/MiniLlmLab.jsx'))
const HistoryLab = lazy(() => import('./labs/HistoryLab.jsx'))

const STAGE_COMPONENTS = {
  1: NeuronLab,
  2: PlaygroundLab,
  3: BackpropLab,
  4: VisionLab,
  5: LanguageLab,
  6: MiniLlmLab,
  7: HistoryLab,
}

function LabLoadingFallback() {
  return (
    <div className="lab-card" role="status" aria-live="polite" style={{ textAlign: 'center', padding: '48px 24px' }}>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', color: 'var(--text-secondary)' }}>
        Warming up the lab...
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
