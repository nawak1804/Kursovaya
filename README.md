# Japan Trip Planner

Интерактивный travel-planner (статический сайт) теперь включает:
- таймлайн по дням + режим по часам,
- Google Maps ссылки в задачах,
- редактирование дней (добавить/удалить/двигать),
- светлую/тёмную тему,
- стеклянный стиль интерфейса (liquid glass),
- виджеты часов (MSK/JST), радио,
- комментарии и рейтинг,
- undo/redo + журнал активности,
- рекламные виджеты (правый, нижний, fullscreen-напоминание),
- кнопку «наверх»,
- локальное сохранение и Cloud Sync (Firebase).

## Локальный запуск
```bash
python3 -m http.server 8000
```

Открыть: `http://localhost:8000`

## Сохранения без Firebase
- Всё хранится в LocalStorage браузера пользователя.
- На другом устройстве/браузере эти данные не появятся.
- При очистке данных сайта (LocalStorage) правки удаляются.

## Cloud Sync
1. Создайте проект Firebase и включите Realtime Database.
2. Скопируйте web-config и вставьте в модалку Cloud Sync.
3. Подключите Sync.

## GitHub Pages
1. Запушьте `index.html`, `styles.css`, `app.js`.
2. В Settings → Pages выберите Deploy from branch.
3. Branch: `main`, folder: `/root`.
