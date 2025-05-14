# superset-cloner-react

## Setup
Install the dependencies as below:
```
git clone git@github.com:nathanbaleeta/superset-cloner-react.git
cd superset-cloner-react
npm install
```

For creating environment variables, update the `.env.local` file with your corresponding OAuth provider credentials

```
VITE__SUPERSET_ENDPOINT=your-superset-endpoint
VITE__SUPERSET_ADMIN_USERNAME=superset-admin-username
VITE__SUPERSET_ADMIN_PASSWORD=superset-admin-password
```

Make sure to prefix your environment variable names with `VITE_` when working with React

## Getting Started
Run the development server: `npm run dev`

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
