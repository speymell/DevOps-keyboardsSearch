const express = require("express");
const fs = require("fs");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const multer = require("multer");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

let questionsData = { questions: [] };

function loadQuestionsData() {
  fs.readFile("./znanija.json", "utf8", (err, data) => {
    if (err) {
      console.error("Ошибка чтения файла:", err);
      questionsData = { questions: [] }; // Если ошибка, присваиваем пустой массив
      return;
    }

    try {
      questionsData = JSON.parse(data);
      console.log("Данные успешно загружены:");
    } catch (parseError) {
      console.error("Ошибка парсинга JSON:", parseError);
      questionsData = { questions: [] }; // Если ошибка парсинга, присваиваем пустой массив
    }
  });
}

const keyboardsDir = path.join(__dirname, "public", "img", "keyboards");

app.get("/keyboards", (req, res) => {
  fs.readdir(keyboardsDir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: "Ошибка при чтении директории" });
    }

    const keyboards = files.map((file) => {
      const id = path.basename(file, path.extname(file)); // Получаем ID из имени файла
      return { id, imagePath: `/img/keyboards/${file}` }; // Возвращаем объект с ID и путем к изображению
    });

    res.json(keyboards);
  });
});

app.delete("/delete-image/:id", (req, res) => {
  const keyboardId = req.params.id;
  const imagePath = path.join(keyboardsDir, `${keyboardId}.webp`);

  console.log(keyboardId);

  fs.unlink(imagePath, (err) => {
    if (err) {
      return res.status(500).json({ error: "Ошибка при удалении изображения" });
    }
    res.json({ message: "Изображение успешно удалено" });
  });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, keyboardsDir); // Папка для сохранения изображений
  },
  filename: (req, file, cb) => {
    const keyboardId = req.body.id;
    console.log("req.body:", req.body);
    console.log("Keyboard ID:", keyboardId);
    const ext = path.extname(file.originalname); // Получаем расширение файла
    cb(null, `${keyboardId}${ext}`); // Сохраняем файл с именем ID
  },
});

const upload = multer({ storage });

app.post("/upload-image", upload.single("image"), (req, res) => {
  console.log("Received body:", req.body);
  console.log("Received file:", req.file);

  const keyboardId = req.body.id; // Получаем ID клавиатуры из тела запроса
  if (!req.file) {
    return res.status(400).json({ error: "Файл не загружен" });
  }

  if (!keyboardId) {
    return res.status(400).json({ error: "ID клавиатуры не указан" });
  }

  const ext = path.extname(req.file.originalname);
  const newFilename = `${keyboardId}${ext}`;
  const newPath = path.join(keyboardsDir, newFilename);

  fs.rename(req.file.path, newPath, (err) => {
    if (err) {
      return res.status(500).json({ error: "Ошибка при переименовании файла" });
    }
    res.json({ message: "Изображение успешно загружено" });
  });
});

loadQuestionsData();

// Эндпоинт для обработки вопросов
app.post("/ask", (req, res) => {
  loadQuestionsData(); // Загружаем актуальные данные перед обработкой запроса
  const { currentQuestionId } = req.body;
  const question = questionsData.questions.find(
    (q) => q.id === currentQuestionId
  );

  if (question) {
    if (question.yes === 0 && question.no === 0) {
      res.send({ result: question.question }); // Возвращаем вопрос как результат
    } else {
      res.send(question);
    }
  } else {
    res.status(404).send("Вопрос не найден");
  }
});

// Эндпоинт для получения всех вопросов
app.get("/data", (req, res) => {
  loadQuestionsData();
  res.set("Cache-Control", "no-store");
  res.json(questionsData);
});

app.post("/save", (req, res) => {
  const updatedData = req.body;

  fs.writeFile(
    "./znanija.json",
    JSON.stringify(updatedData, null, 2),
    (err) => {
      if (err) {
        console.error("Ошибка записи файла:", err);
        return res.status(500).send("Ошибка при сохранении данных");
      }
      res.send("Данные успешно сохранены");
    }
  );
});

app.post("/add-rule", (req, res) => {
  loadQuestionsData();

  const newRule = req.body;

  const maxId = questionsData.questions.reduce(
    (max, q) => (q.id > max ? q.id : max),
    0
  );

  const structuredRule = {
    id: maxId + 1,
    question: newRule.question,
    yes: 0,
    no: 0,
    key_field: newRule.key_field || 0,
    negative: newRule.negative || "",
  };

  questionsData.questions.push(structuredRule);

  fs.writeFile(
    "./znanija.json",
    JSON.stringify(questionsData, null, 2),
    (err) => {
      if (err) {
        console.error("Ошибка записи файла:", err);
        return res.status(500).send("Ошибка при сохранении данных");
      }
      res.status(201).send("Новое правило успешно добавлено");
    }
  );
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
