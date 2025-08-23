import express from 'express';
import cors from 'cors';
import tontinesRoutes from './routes/tontines.js';
import membresRoutes from './routes/membres.js';
import cotisationsRoutes from './routes/cotisations.js';

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/tontines', tontinesRoutes);
app.use('/api/membres', membresRoutes);
app.use('/api/cotisations', cotisationsRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
