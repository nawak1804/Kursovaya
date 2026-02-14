# Japan Trip Planner

Интерактивный travel-planner (статический сайт):
- таймлайн по дням,
- задачи и drag&drop,
- редактирование самой календарной ленты (добавить/удалить/переместить день),
- светлая/тёмная тема,
- локальное сохранение,
- Cloud Sync через Firebase Realtime Database.

## Локальный запуск

```bash
python3 -m http.server 8000
```

Открыть: `http://localhost:8000`

## Как сейчас работает сохранение без Firebase

- Все правки сохраняются **локально в браузере** (LocalStorage).
- Это значит: данные видны только в этом браузере и на этом устройстве.
- Если очистить данные сайта/кэш LocalStorage — изменения пропадут.
- Между пользователями/устройствами без Firebase данные **не синхронизируются**.

## Общие изменения для всех (Cloud Sync)

1. Создайте проект в Firebase.
2. Включите **Realtime Database** (режим test для старта).
3. Добавьте Web App в Firebase и скопируйте config (`apiKey`, `authDomain`, `databaseURL`, `projectId`, `appId`).
4. На сайте нажмите **Cloud Sync** и вставьте эти значения.
5. Нажмите **Подключить Sync**.

После этого изменения в плане будут автоматически отражаться у всех, кто подключен к тому же Firebase проекту/пути.

## Деплой на GitHub Pages

1. Создайте репозиторий и запушьте файлы (`index.html`, `styles.css`, `app.js`).
2. Откройте **Settings → Pages**.
3. В разделе **Build and deployment** выберите:
   - Source: `Deploy from a branch`
   - Branch: `main` (или ваша), folder: `/ (root)`
4. Сохраните и дождитесь публикации.
5. Получите ссылку вида: `https://<username>.github.io/<repo>/`

Важно: для Cloud Sync на проде добавьте домен GitHub Pages в Firebase Authorized domains (если потребуется) и используйте правила безопасности БД.
