
const express = require('express');
const cors = require('cors')
const app = express();
const mongoose = require('mongoose');
const dotenv = require('dotenv')
const OpenAI = require('openai');
const axios = require('axios');


dotenv.config({ path: './config.env' });

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));





// app.post("/api/chat", async (req, res) => {
//   try {
//     const { message } = req.body;

//     const response = await axios.post(
//       "http://localhost:11434/api/generate",
//       {
//         model: "llama3",
//         prompt: message,
//         stream: false
//       }
//     );

//     res.json({
//       reply: response.data.response
//     });

//   } catch (error) {
//     res.status(500).json({ error: "Local AI error" });
//   }
// });

app.post("/api/chat", async (req, res) => {
    try {
        const { message } = req.body;

        const response = await fetch(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "http://localhost:5173",
                    "X-Title": "React OpenRouter App",
                },
                body: JSON.stringify({
                    model: "openai/gpt-4o-mini",
                    messages: [{ role: "user", content: message }],
                }),
            }
        );

        const text = await response.text(); // 👈 raw text
        res.status(response.status).send(text);

    } catch (err) {
        console.error("Backend error:", err);
        res.status(500).json({ error: err.message });
    }
});

mongoose.connect(process.env.CONN_STR, { dbName: 'S8Project' })
    .then(() => console.log("✅ Connection successful"))
    .catch((e) => { console.log("Connection Error:", e.message); console.log("Not connected ") });

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required field']
    },
    email: {
        type: String,
        required: [true, 'Email is required field'],
        unique: true
    },
    password: {
        type: String,
        required: [true, 'Password is required field'],
        unique: false
    },
    gamesPlayed: { type: Number, default: 0 },
    articlesRead: { type: Number, default: 0 },
    totalPoints: { type: Number, default: 0 },
    dob: { type: String },
    mastery: {
        executive: { type: Number, default: 0 },
        legislature: { type: Number, default: 0 },
        judiciary: { type: Number, default: 0 }
    },
    pointsBreakdown: {
        articleMatch: { type: Number, default: 0 },
        rightsDutiesClimb: { type: Number, default: 0 },
        constitutionCards: { type: Number, default: 0 },
        chakra: { type: Number, default: 0 }
    },
    profileImage: { type: String }
});


const datas = mongoose.model('userlogins', userSchema);

app.post('/signup', async (req, res) => {
    try {
        const newuser = await datas.create(req.body);
        res.json({
            message: "Successful"
        });
    } catch (e) {
        res.status(404).json({
            Error: e.errorResponse.errmsg
        });
    }
})


app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const e = await datas.findOne({ email });
        console.log(e);

        if (e.password === password) {
            res.json({
                status: true,
                msg: "Login successfull",
                name: e.name,
                profileImage: e.profileImage
            })
        } else {
            res.status(404).json({
                status: false,
                Error: "User not found"
            })
        }
    } catch (e) {
        res.status(404).json({
            Error: "Not Found",
            msg: e
        })
    }
})

app.post('/guest', (req, res) => {
    const { name } = req.body;
    console.log(name);
    res.json(
        {
            message: "Guest login successful",
            user: name
        }
    );
})



app.get('/api/articles', async (req, res) => {
    console.log("request came");

    try {
        const data = await mongoose.connection.collection('articaldatas').find({}).toArray();
        res.json(data);

    } catch (e) {
        console.log(e);
    }
});

// Progress Endpoints
app.get('/api/progress/:email', async (req, res) => {
    try {
        const user = await datas.findOne({ email: req.params.email });
        if (!user) return res.status(404).json({ error: "User not found" });
        res.json(user);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/progress/update', async (req, res) => {
    try {
        const { email, gamesPlayed, articlesRead, totalPoints, mastery, gameId } = req.body;
        const update = {};
        if (gamesPlayed !== undefined) update.$inc = { ...update.$inc, gamesPlayed };
        if (articlesRead !== undefined) update.$inc = { ...update.$inc, articlesRead };
        if (totalPoints !== undefined) {
            update.$inc = { ...update.$inc, totalPoints };
            // If gameId is provided, also increment that specific game's points
            if (gameId) {
                update.$inc = { ...update.$inc, [`pointsBreakdown.${gameId}`]: totalPoints };
            }
        }

        if (mastery) {
            for (const key in mastery) {
                update.$inc = { ...update.$inc, [`mastery.${key}`]: mastery[key] };
            }
        }

        const user = await datas.findOneAndUpdate({ email }, update, { new: true });
        if (!user) return res.status(404).json({ error: "User not found" });
        res.json(user);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/user/update', async (req, res) => {
    try {
        const { email, name, dob, profileImage } = req.body;
        const update = {};
        if (name) update.name = name;
        if (dob) update.dob = dob;
        if (profileImage) update.profileImage = profileImage;

        const user = await datas.findOneAndUpdate({ email }, { $set: update }, { new: true });
        if (!user) return res.status(404).json({ error: "User not found" });
        res.json({
            message: "Profile updated successfully",
            user: user
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/leaderboard', async (req, res) => {
    try {
        const topUsers = await datas.find({}).sort({ totalPoints: -1 }).limit(10).select('name totalPoints');
        res.json(topUsers);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});



app.listen(3000, () => {
    console.log("Server Listining...");
})