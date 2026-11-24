/**
 * Chronological history of Neural Networks & Large Language Models (1943–2026).
 * Links each historical milestone back to an interactive lab stage (1..6).
 */

export const HISTORY_ERAS = [
  {
    id: 'sparks',
    title: 'The Spark of Artificial Neurons (1943–1969)',
    years: '1943–1969',
    color: '#f59e0b',
    summary:
      'Scientists sketched the very first mathematical brain cells, built learning machines out of wires, and discovered the famous puzzle that stumped single-layer networks.',
  },
  {
    id: 'layers',
    title: 'Learning Through Layers (1986–2012)',
    years: '1986–2012',
    color: '#10b981',
    summary:
      'Backpropagation, convolutional vision filters, memory cells, and fast graphics cards unlocked deep multi-layer networks that could see and remember.',
  },
  {
    id: 'attention',
    title: 'Words Become Math & Attention Arrives (2013–2017)',
    years: '2013–2017',
    color: '#8b5cf6',
    summary:
      'Researchers turned words into geometry and invented the Transformer — letting AI read whole sentences in parallel using self-attention.',
  },
  {
    id: 'llms',
    title: 'The Age of Large Language Models (2018–Today)',
    years: '2018–Today',
    color: '#0ea5e9',
    summary:
      'Scaling Transformers to billions of parameters, aligning them with human feedback, and adding vision and step-by-step reasoning brought AI to everyone.',
  },
];

export const LLM_HISTORY_MILESTONES = [
  {
    id: 'mcculloch-pitts-1943',
    year: '1943',
    eraId: 'sparks',
    title: 'McCulloch & Pitts Artificial Neuron',
    people: 'Warren McCulloch & Walter Pitts',
    emoji: '⚡',
    kidStory:
      'Before modern computers even existed on desks, a brain scientist and a teenage math whiz drew the first blueprint of a pretend brain cell on paper. It took in yes-or-no signals, added them up, and fired whenever the total passed a limit!',
    breakthrough:
      'Proved that simple math switches inspired by biological neurons could perform logical reasoning like AND, OR, and NOT.',
    deepDive:
      'McCulloch and Pitts formulated the Threshold Logic Unit (TLU), showing that networks of binary threshold neurons with excitatory and inhibitory connections are Turing-complete for finite-state logic, though their model did not yet include a learning rule.',
    relatedStageId: 1,
    funFact:
      'Walter Pitts was only 19 years old when they published this landmark paper — and he had taught himself logic in public libraries!',
  },
  {
    id: 'rosenblatt-perceptron-1957',
    year: '1957',
    eraId: 'sparks',
    title: "Frank Rosenblatt's Perceptron",
    people: 'Frank Rosenblatt',
    emoji: '🎛️',
    kidStory:
      'Psychologist Frank Rosenblatt built a real room-sized machine called the Mark I Perceptron that could actually learn! Whenever it guessed a shape wrong, tiny electric motors physically twisted its weight knobs so it would do better next time.',
    breakthrough:
      'Introduced the first trainable artificial neuron with adjustable weights and a guaranteed learning rule for linearly separable patterns.',
    deepDive:
      'Rosenblatt’s Perceptron Learning Algorithm updated weights via w ← w + η(y − ŷ)x on misclassified examples. Novikoff later proved the Perceptron Convergence Theorem: if a linear separator exists, the algorithm converges in finite steps.',
    relatedStageId: 1,
    funFact:
      'The Mark I Perceptron used 400 light sensors wired to motorized potentiometers — a literal spaghetti tangle of cables!',
  },
  {
    id: 'xor-ai-winter-1969',
    year: '1969',
    eraId: 'sparks',
    title: 'The XOR Problem & First AI Winter',
    people: 'Marvin Minsky & Seymour Papert',
    emoji: '❄️',
    kidStory:
      'Two famous professors published a book showing that a single perceptron could never solve a simple checkerboard puzzle called XOR. Many people gave up on neural networks for over a decade, kicking off the chilly "First AI Winter."',
    breakthrough:
      'Exposed the geometric limit of single-layer linear models — motivating researchers to figure out how to train multi-layer networks.',
    deepDive:
      'In "Perceptrons" (1969), Minsky and Papert rigorously proved that a single-layer perceptron cannot compute non-linearly separable predicates such as XOR or connectedness. While multi-layer networks could represent XOR, no practical credit-assignment algorithm was yet widely adopted.',
    relatedStageId: 2,
    funFact:
      'Seymour Papert later created the Logo programming language and its famous drawing turtle to help kids learn math and coding!',
  },
  {
    id: 'backpropagation-1986',
    year: '1986',
    eraId: 'layers',
    title: 'Backpropagation Popularized',
    people: 'David Rumelhart, Geoffrey Hinton & Ronald Williams',
    emoji: '⛰️',
    kidStory:
      'How do you teach a team of hidden neurons when only the last neuron sees the mistake? In 1986, researchers showed how to pass error notes backward through every layer so every single weight could improve together — melting the AI winter!',
    breakthrough:
      'Made training deep Multi-Layer Perceptrons practical by efficiently computing exact error gradients for every hidden weight.',
    deepDive:
      'Building on earlier reverse-mode automatic differentiation work (Linnainmaa, Werbos), Rumelhart, Hinton, and Williams demonstrated that backpropagation with stochastic gradient descent learns meaningful internal representations in hidden layers, solving XOR and sequence tasks.',
    relatedStageId: 3,
    funFact:
      'Geoffrey Hinton later won both the Turing Award (2018) and the Nobel Prize in Physics (2024) for his foundational neural network work.',
  },
  {
    id: 'cnn-lenet-1989-1998',
    year: '1989/1998',
    eraId: 'layers',
    title: 'Convolutional Neural Networks / LeNet',
    people: 'Yann LeCun & collaborators',
    emoji: '👁️',
    kidStory:
      'Instead of memorizing every pixel separately, Yann LeCun taught neural networks to slide tiny detective filters across pictures to spot strokes and curves. His LeNet system became so good at reading messy handwriting that banks used it to read millions of checks!',
    breakthrough:
      'Combined shared sliding filters (convolutions) with backpropagation to create networks built specifically for visual patterns.',
    deepDive:
      'LeNet-1 (1989) and LeNet-5 (1998) introduced weight-sharing convolutional layers, subsampling (pooling), and end-to-end gradient training on handwritten digits (MNIST), dramatically reducing parameter count while achieving translation invariance.',
    relatedStageId: 4,
    funFact:
      'At its peak in the late 1990s, LeNet was reading roughly 10% of all paper checks written in the United States!',
  },
  {
    id: 'lstm-1997',
    year: '1997',
    eraId: 'layers',
    title: 'LSTM & Sequence Memory',
    people: 'Sepp Hochreiter & Jürgen Schmidhuber',
    emoji: '🧠',
    kidStory:
      'Early reading networks had goldfish memory — by the end of a long sentence, they forgot how it started! Long Short-Term Memory (LSTM) gave networks a notebook with smart gates to decide what to remember and what to erase.',
    breakthrough:
      'Solved the vanishing gradient problem in sequences, enabling AI to handle speech recognition, translation, and long sentences.',
    deepDive:
      'Long Short-Term Memory networks introduced an additive cell state regulated by learned input, forget, and output gates, creating a constant-error carousel that preserved gradient flow across hundreds of time steps.',
    relatedStageId: 5,
    funFact:
      'For nearly two decades, LSTMs powered the voice recognition and translation apps on billions of smartphones before Transformers took over.',
  },
  {
    id: 'alexnet-2012',
    year: '2012',
    eraId: 'layers',
    title: 'AlexNet & The GPU Deep Learning Breakthrough',
    people: 'Alex Krizhevsky, Ilya Sutskever & Geoffrey Hinton',
    emoji: '🚀',
    kidStory:
      'In a giant worldwide photo-guessing contest called ImageNet, a deep neural network named AlexNet crushed every rival by a huge margin! Its secret weapon? Training on video-game graphics cards (GPUs) that could do millions of math steps at once.',
    breakthrough:
      'Sparked the modern Deep Learning revolution by pairing deep CNNs, ReLU activations, dropout, and massive GPU compute.',
    deepDive:
      'AlexNet cut ImageNet top-5 classification error from 26.2% to 15.3% using an 8-layer CNN trained across two NVIDIA GTX 580 GPUs, popularizing ReLU nonlinearities, dropout regularization, and data augmentation across the entire field.',
    relatedStageId: 4,
    funFact:
      'AlexNet was trained in Alex Krizhevsky’s bedroom on two off-the-shelf gaming graphics cards that kept the room noticeably warm!',
  },
  {
    id: 'word2vec-2013',
    year: '2013',
    eraId: 'attention',
    title: 'Word2Vec: Turning Words into Meaning Vectors',
    people: 'Tomas Mikolov & Google Research team',
    emoji: '🧭',
    kidStory:
      'Researchers discovered a magical trick: by guessing missing words from their neighbors, a neural network automatically places every word on a giant meaning map. Suddenly you could do real math with ideas — like King − Man + Woman = Queen!',
    breakthrough:
      'Showed that dense word embeddings learned from unlabeled text capture rich semantic relationships as simple vector geometry.',
    deepDive:
      'Word2Vec’s Skip-Gram and CBOW architectures trained shallow neural networks with negative sampling over billions of words, producing compact dense embeddings where syntactic and semantic analogies emerged as linear vector offsets.',
    relatedStageId: 5,
    funFact:
      'The Word2Vec map didn’t just learn royal families — it also figured out capitals like Paris − France + Japan ≈ Tokyo without a geography lesson!',
  },
  {
    id: 'transformer-2017',
    year: '2017',
    eraId: 'attention',
    title: '"Attention Is All You Need": The Transformer',
    people: 'Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit, Llion Jones, Aidan Gomez, Łukasz Kaiser & Illia Polosukhin',
    emoji: '✨',
    kidStory:
      'Instead of reading one word at a time like a slow conveyor belt, eight researchers invented the Transformer. Using a spotlight called Self-Attention, every word could look at every other word at the exact same time — making language AI way faster and smarter!',
    breakthrough:
      'Replaced slow sequential recurrence with parallel multi-head self-attention, creating the blueprint behind almost every modern LLM.',
    deepDive:
      'The Transformer architecture relies entirely on stacked multi-head scaled dot-product self-attention, positional encodings, residual connections, and feed-forward layers. Removing recurrence unlocked massive parallelization across GPUs and TPUs.',
    relatedStageId: 5,
    funFact:
      'The "T" in GPT and ChatGPT stands for Transformer — directly named after this 2017 paper!',
  },
  {
    id: 'gpt-scaling-2018-2020',
    year: '2018–2020',
    eraId: 'llms',
    title: 'GPT-1, GPT-2, GPT-3 & Scaling Laws',
    people: 'OpenAI & Scaling Laws researchers (Kaplan et al.)',
    emoji: '📈',
    kidStory:
      'Scientists asked a bold question: what happens if you take a Transformer, make it thousands of times bigger, and let it practice next-word prediction on huge libraries of text? Surprise — it started writing stories, translating languages, and coding from just a few examples!',
    breakthrough:
      'Demonstrated predictable scaling laws and "in-context learning," where large pretrained models solve new tasks from a prompt alone.',
    deepDive:
      'From GPT-1 (117M parameters) to GPT-2 (1.5B) and GPT-3 (175B), autoregressive decoder-only Transformers exhibited smooth power-law loss improvements with compute, data, and parameters — unlocking few-shot prompting without gradient updates.',
    relatedStageId: 6,
    funFact:
      'GPT-3 had 175 billion adjustable weights — more than 20 times the number of people living on planet Earth!',
  },
  {
    id: 'rlhf-chatgpt-2022',
    year: '2022',
    eraId: 'llms',
    title: 'RLHF & Conversational AI (ChatGPT)',
    people: 'InstructGPT / ChatGPT teams & alignment researchers',
    emoji: '💬',
    kidStory:
      'A raw next-word predictor sometimes just rambles like a textbook instead of answering your question. By having human teachers rate helpful replies (RLHF), AI learned to become a polite, back-and-forth helper — and hundreds of millions of people tried it in months!',
    breakthrough:
      'Turned base next-token predictors into helpful, instruction-following conversational assistants via Reinforcement Learning from Human Feedback.',
    deepDive:
      'Fine-tuning pretrained LLMs with supervised instruction demonstrations followed by reward modeling and PPO (RLHF) aligned model outputs with human intent, truthfulness, and safety — sparking mainstream global adoption.',
    relatedStageId: 6,
    funFact:
      'ChatGPT reached 100 million monthly users in just two months — the fastest-growing consumer app in internet history at the time!',
  },
  {
    id: 'multimodal-reasoning-2023-2026',
    year: '2023–2026',
    eraId: 'llms',
    title: 'Multimodal, Open-Weights & Reasoning Models',
    people: 'Global AI labs & open-source community',
    emoji: '🌟',
    kidStory:
      'Today’s AI models don’t just read text — they can see photos, listen to voices, sketch code, and even pause to "think step by step" before answering hard puzzles. Plus, open-weight models let students and makers run mini-AIs right on their own laptops!',
    breakthrough:
      'Unified text, vision, and audio into multimodal models while introducing test-time reasoning and powerful open-weights ecosystems.',
    deepDive:
      'Recent frontiers combine native multimodal tokenization (text, image, audio, video), mixture-of-experts efficiency, open-weight releases (Llama, Gemma, Qwen, DeepSeek), and reinforcement-learned chain-of-thought reasoning that scales performance with test-time compute.',
    relatedStageId: 6,
    funFact:
      'Some modern reasoning models check their own math and fix their own mistakes mid-thought — just like showing your work on a school test!',
  },
];

export function getMilestonesByEra(eraId) {
  return LLM_HISTORY_MILESTONES.filter((m) => m.eraId === eraId);
}
