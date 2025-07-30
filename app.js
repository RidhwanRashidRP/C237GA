const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const path = require('path');
const app = express();

// ========== Multer Config ==========
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// ========== DB Connection ==========
const db = mysql.createConnection({
    host: 'c237-all.mysql.database.azure.com',
    user: 'c237admin',
    password: 'c2372025!',
    database: 'c237_003_team2'
});

db.connect(err => {
    if (err) throw err;
    console.log('Connected to database');
});

// ========== Middleware ==========
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('public/uploads'));

app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

app.use(flash());
app.set('view engine', 'ejs');

// ========== Auth Middlewares ==========
const checkAuthenticated = (req, res, next) => {
    console.log("Session user:", req.session.user);
    if (req.session.user) return next();
    req.flash('error', 'Please log in');
    res.redirect('/login');
};

const checkAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') return next();
    req.flash('error', 'Access denied');
    res.redirect('/dashboard');
};

// ========== Routes ==========

app.get('/', (req, res) => {
    res.render('index', { user: req.session.user, messages: req.flash('success') });
});

// ----- Register -----
app.get('/register', (req, res) => {
    res.render('register', { messages: req.flash('error'), formData: req.flash('formData')[0] });
});

app.post('/register', (req, res) => {
    const { username, email, password, address, contact, role } = req.body;
    if (!username || !email || !password || !address || !contact) {
        return res.status(400).send("All fields required.");
    }

    const sql = 'INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, SHA1(?), ?, ?, ?)';
    db.query(sql, [username, email, password, address, contact, role], (err) => {
        if (err) throw err;
        req.flash('success', 'Registration successful! Please log in.');
        res.redirect('/login');
    });
});

// ----- Login -----
app.get('/login', (req, res) => {
    res.render('login', {
        messages: req.flash('success'),
        errors: req.flash('error')
    });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/login');
    }

    const sql = 'SELECT * FROM users WHERE email = ? AND password = SHA1(?)';
    db.query(sql, [email, password], (err, results) => {
        if (err) throw err;
        if (results.length > 0) {
            const user = results[0];
            req.session.user = user;
            req.flash('success', 'Login successful!');
            return res.redirect(user.role === 'admin' ? '/dashboard' : '/movies');
        } else {
            req.flash('error', 'Invalid credentials.');
            return res.redirect('/login');
        }
    });
});

// ----- Dashboard -----
app.get('/dashboard', checkAuthenticated, (req, res) => {
    res.render('dashboard', { user: req.session.user });
});

// ----- Admin Panel -----
app.get('/admin', checkAuthenticated, checkAdmin, (req, res) => {
    db.query('SELECT * FROM movies', (err, movies) => {
        if (err) throw err;
        res.render('admin', { user: req.session.user, movies });
    });
});

// ----- Movies Listing -----
app.get('/movies', checkAuthenticated, (req, res) => {
    const search = req.query.search || '';
    const genre = req.query.genre || '';
    const sql = `SELECT * FROM movies WHERE title LIKE ? AND (? = '' OR genre = ?)`;

    db.query(sql, [`%${search}%`, genre, genre], (err, movies) => {
        if (err) throw err;
        db.query('SELECT DISTINCT genre FROM movies', (err, genresResult) => {
            if (err) throw err;
            const genres = genresResult.map(g => g.genre);
            res.render('movies', {
                user: req.session.user,
                movies,
                genres,
                search,
                genre
            });
        });
    });
});

// ----- Add Movie -----
app.get('/movies/add', checkAuthenticated, checkAdmin, (req, res) => {
    res.render('addMovie', { user: req.session.user });
});

app.post('/movies/add', checkAuthenticated, checkAdmin, upload.single('image'), (req, res) => {
    const { title, genre, year, rating, review } = req.body;
    const image = req.file ? req.file.filename : null;

    const sql = 'INSERT INTO movies (title, genre, year, rating, image, review) VALUES (?, ?, ?, ?, ?, ?)';
    db.query(sql, [title, genre, year, rating, image, review], (err) => {
        if (err) throw err;
        res.redirect('/admin');
    });
});

// ----- Edit Movie -----
app.get('/movies/edit/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const movieId = req.params.id;
    db.query('SELECT * FROM movies WHERE id = ?', [movieId], (err, results) => {
        if (err) throw err;
        if (results.length > 0) {
            res.render('editMovie', { movie: results[0], user: req.session.user });
        } else {
            res.status(404).send('Movie not found');
        }
    });
});

app.post('/movies/edit/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const movieId = req.params.id;
    const { title, genre, year, rating, image, review } = req.body;

    const sql = 'UPDATE movies SET title = ?, genre = ?, year = ?, rating = ?, image = ?, review = ? WHERE id = ?';
    db.query(sql, [title, genre, year, rating, image, review, movieId], (err) => {
        if (err) throw err;
        res.redirect('/admin');
    });
});

// ----- Delete Movie -----
app.post('/movies/delete/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const movieId = req.params.id;
    db.query('DELETE FROM movies WHERE id = ?', [movieId], (err) => {
        if (err) throw err;
        res.redirect('/admin');
    });
});

// ----- Upload View -----
app.get('/upload', (req, res) => {
    res.render('upload');
});

app.post('/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }
    res.send(`File uploaded successfully: <a href="/uploads/${req.file.filename}">View Image</a>`);
});

// ----- Logout -----
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

// ========== Start Server ==========
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
