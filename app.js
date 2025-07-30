const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');
const app = express();

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

app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));

app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } // 1 week
}));

app.use(flash());
app.set('view engine', 'ejs');

// Middleware
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
        req.flash('error', 'Password should be at least 6 or more characters long');
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
    db.query(sql, [username, email, password, address, contact, role], (err, result) => {
        if (err) throw err;
        req.flash('success', 'Registration successful! Please log in.');
        res.redirect('/login');
    });
});

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
            const role = user.role ? user.role.trim().toLowerCase() : '';

            console.log('Logged in as role:', role); // 🔍 debug

            req.session.user = user;
            req.flash('success', 'Login successful!');

            if (role === 'admin') {
                return res.redirect('/dashboard'); // Admin view
            } else {
                return res.redirect('/movies'); // User view
            }
        } else {
            req.flash('error', 'Invalid email or password.');
            return res.redirect('/login');
        }
    });
});


app.get('/admin', checkAuthenticated, checkAdmin, (req, res) => {
    db.query('SELECT * FROM movies', (err, movies) => {
        if (err) throw err;
        res.render('admin', { user: req.session.user, movies });
    });
});

app.get('/dashboard', checkAuthenticated, (req, res) => {
    res.render('dashboard', { user: req.session.user });
});

app.get('/movies', checkAuthenticated, (req, res) => {
    const search = req.query.search || '';
    const genre = req.query.genre || '';

    const sql = `
        SELECT * FROM movies 
        WHERE title LIKE ? AND (? = '' OR genre = ?)
    `;
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

app.get('/addMovie', checkAuthenticated, (req, res) => {
    res.render('addMovie', { user: req.session.user });
});

app.post('/addMovie', checkAuthenticated, (req, res) => {
    const { title, genre, year, rating, image, review } = req.body;
    const sql = 'INSERT INTO movies (title, genre, year, rating, image, review) VALUES (?, ?, ?, ?, ?, ?)';
    db.query(sql, [title, genre, year, rating, image, review], (error) => {
        if (error) {
            console.error("Error adding movie:", error);
            res.status(500).send('Error adding movie.');
        } else {
            res.redirect('/movies');
        }
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

app.post('/movies/add', checkAuthenticated, checkAdmin, (req, res) => {
    const { title, genre, year, rating, image, review } = req.body;
    const sql = 'INSERT INTO movies (title, genre, year, rating, image, review) VALUES (?, ?, ?, ?, ?, ?)';

    db.query(sql, [title, genre, year, rating, image, review], (err) => {
        if (err) throw err;
        res.redirect('/admin'); // redirect back to admin dashboard
    });
});

// Show the edit form for a movie
app.get('/movies/edit/:id', checkAuthenticated, (req, res) => {
    const movieId = req.params.id;
    const sql = 'SELECT * FROM movies WHERE id = ?';

    db.query(sql, [movieId], (err, results) => {
        if (err) throw err;

        if (results.length > 0) {
            res.render('editMovie', { movie: results[0], user: req.session.user });
        } else {
            res.status(404).send('Movie not found.');
        }
    });
});

// Handle movie update
app.post('/movies/edit/:id', checkAuthenticated, (req, res) => {
    const movieId = req.params.id;
    const { title, genre, year, rating, image, review } = req.body;

    const sql = `
        UPDATE movies 
        SET title = ?, genre = ?, year = ?, rating = ?, image = ?, review = ?
        WHERE id = ?
    `;
    db.query(sql, [title, genre, year, rating, image, review, movieId], (err) => {
        if (err) throw err;
        res.redirect('/movies');
    });
});

// Handle movie deletion
app.post('/movies/delete/:id', checkAuthenticated, (req, res) => {
    const movieId = req.params.id;

    const sql = 'DELETE FROM movies WHERE id = ?';
    db.query(sql, [movieId], (err) => {
        if (err) throw err;
        res.redirect('/movies');
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server started on port 3000: http://localhost:${PORT}/`);
});
