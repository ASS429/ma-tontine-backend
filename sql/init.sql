CREATE TABLE tontines (
    id SERIAL PRIMARY KEY,
    nom TEXT,
    cotisation INT,
    frequence TEXT,
    max_membres INT,
    type TEXT,
    description TEXT
);

CREATE TABLE membres (
    id SERIAL PRIMARY KEY,
    nom TEXT,
    telephone TEXT,
    tontine_id INT REFERENCES tontines(id)
);

CREATE TABLE paiements (
    id SERIAL PRIMARY KEY,
    membre_id INT REFERENCES membres(id),
    montant INT,
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tirages (
    id SERIAL PRIMARY KEY,
    tontine_id INT REFERENCES tontines(id),
    gagnant_id INT REFERENCES membres(id),
    montant INT,
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
