const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const path = require('path');
const app = express();

// Multer storage config
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Database connection
const db = mysql.createConnection({
    host: 'c237-all.mysql.database.azure.com',
    user: 'c237admin',
    password: 'c2372025!',
    database: 'c237_003_team2'
});
db.connect((err) => {
    if (err) throw err;
    console.log('Connected to database');
});

// Middleware
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

// Auth middleware
const checkAuthenticated = (req, res, next) => {
    if (req.session.user) return next();
    req.flash('error', 'Please log in to view this resource');
    res.redirect('/login');
};

const checkAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') return next();
    req.flash('error', 'Access denied');
    res.redirect('/dashboard');
};

const validateRegistration = (req, res, next) => {
    const { username, email, password, address, contact } = req.body;
    if (!username || !email || !password || !address || !contact) {
        return res.status(400).send("All fields are required.");
    }
    if (password.length < 6) {
        req.flash('error', 'Password should be at least 6 characters');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    next();
};

// Routes
app.get('/', (req, res) => {
    res.render('index', { user: req.session.user, messages: req.flash('success') });
});

app.get('/register', (req, res) => {
    res.render('register', { messages: req.flash('error'), formData: req.flash('formData')[0] });
});

app.post('/register', validateRegistration, (req, res) => {
    const { username, email, password, address, contact, role } = req.body;
    const sql = 'INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, SHA1(?), ?, ?, ?)';
    db.query(sql, [username, email, password, address, contact, role], (err) => {
        if (err) throw err;
        req.flash('success', 'Registration successful! Please log in.');
        res.redirect('/login');
    });
});

app.get('/login', (req, res) => {
    res.render('login', { messages: req.flash('success'), errors: req.flash('error') });
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
            return user.role.trim().toLowerCase() === 'admin'
                ? res.redirect('/dashboard')
                : res.redirect('/movies');
        } else {
            req.flash('error', 'Invalid email or password.');
            return res.redirect('/login');
        }
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

app.get('/dashboard', checkAuthenticated, (req, res) => {
    res.render('dashboard', { user: req.session.user });
});

app.get('/movies', checkAuthenticated, (req, res) => {
    const search = req.query.search || '';
    const genre = req.query.genre || '';
    const sql = `SELECT * FROM movies WHERE title LIKE ? AND (? = '' OR genre = ?)`;
    db.query(sql, [`%${search}%`, genre, genre], (err, movies) => {
        if (err) throw err;
        db.query('SELECT DISTINCT genre FROM movies', (err, genreRows) => {
            if (err) throw err;
            const genres = genreRows.map(g => g.genre);
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

app.get('/admin', checkAuthenticated, checkAdmin, (req, res) => {
    db.query('SELECT * FROM movies', (err, movies) => {
        if (err) throw err;
        res.render('admin', { user: req.session.user, movies });
    });
});

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

app.get('/movies/edit/:id', checkAuthenticated, (req, res) => {
    const movieId = req.params.id;
    db.query('SELECT * FROM movies WHERE id = ?', [movieId], (err, results) => {
        if (err) throw err;
        if (results.length > 0) {
            res.render('editMovie', { movie: results[0], user: req.session.user });
        } else {
            res.status(404).send('Movie not found.');
        }
    });
});

app.post('/movies/edit/:id', checkAuthenticated, (req, res) => {
    const movieId = req.params.id;
    const { title, genre, year, rating, image, review } = req.body;
    const sql = `UPDATE movies SET title = ?, genre = ?, year = ?, rating = ?, image = ?, review = ? WHERE id = ?`;
    db.query(sql, [title, genre, year, rating, image, review, movieId], (err) => {
        if (err) throw err;
        res.redirect('/movies');
    });
});

app.post('/movies/delete/:id', checkAuthenticated, (req, res) => {
    const movieId = req.params.id;
    db.query('DELETE FROM movies WHERE id = ?', [movieId], (err) => {
        if (err) throw err;
        res.redirect('/movies');
    });
});

app.get('/upload', (req, res) => {
    res.render('upload');
});

app.post('/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }
    res.send(`File uploaded successfully: <a href="/uploads/${req.file.filename}">View Image</a>`);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server started on http://localhost:${PORT}`);
});
