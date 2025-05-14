import React, { createContext, useState, useEffect } from "react";
import DashboardIcon from '@mui/icons-material/Dashboard';
import { Outlet } from 'react-router';
import { ReactRouterAppProvider } from '@toolpad/core/react-router';
import type { Navigation } from '@toolpad/core/AppProvider';

import CssBaseline from '@mui/material/CssBaseline';
import { CssVarsProvider as JoyCssVarsProvider } from '@mui/joy/styles';
import {
  createTheme,
  ThemeProvider,
  THEME_ID as MATERIAL_THEME_ID,
} from '@mui/material/styles';


const NAVIGATION: Navigation = [
  {
    kind: 'header',
    title: 'Main items',
  },
  {
    title: 'Dashboard',
    icon: <DashboardIcon />,
  },
];

const BRANDING = {
  title: "Dashboard Cloner",
};

// API host credentials & Endpoints
// https://stackoverflow.com/questions/78114219/property-env-does-not-exist-on-type-importmeta-ts2339
const SUPERSET_ENDPOINT: string = import.meta.env.VITE_SUPERSET_ENDPOINT; 
const SECURITY_LOGIN_ENDPOINT: string = `${SUPERSET_ENDPOINT}/api/v1/security/login`;
const SECURITY_API_CSRF_ENDPOINT: string = `${SUPERSET_ENDPOINT}/api/v1/security/csrf_token/`;

const SUPERSET_ADMIN_USERNAME = import.meta.env.VITE_SUPERSET_ADMIN_USERNAME;
const SUPERSET_ADMIN_PASSWORD = import.meta.env.VITE_SUPERSET_ADMIN_PASSWORD;

//export const AuthContext = createContext({ accessToken: "", csrfToken: "" });
export const AuthContext = createContext({ accessToken: "", csrfToken: "" });

const AuthProvider = ({ children }) => {
  const [accessToken, setAccessToken] = useState(""); 
  const [csrfToken, setCsrfToken] = useState(""); 

  const getAccessToken = async () => {
    const response = await fetch(SECURITY_LOGIN_ENDPOINT, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: SUPERSET_ADMIN_USERNAME,
        password: SUPERSET_ADMIN_PASSWORD,
        provider: 'db',
        refresh: true
      })
    })
    const result = await response.json();
    setAccessToken(result['access_token'])
    sessionStorage.setItem('accessToken', result['access_token'])
  }

  const getCSRFToken = async () => {
    const ACCESS_TOKEN = sessionStorage.getItem('accessToken')
    const response = await fetch(SECURITY_API_CSRF_ENDPOINT, {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Authorization': 'Bearer ' + ACCESS_TOKEN
      }
    })
    const data = await response.json();
    setCsrfToken(data['result'])
  }

  useEffect(() => {
    getAccessToken(),
    getCSRFToken()
  }, [SECURITY_LOGIN_ENDPOINT, SECURITY_API_CSRF_ENDPOINT]);

  useEffect(() => {
    if (accessToken) {
      sessionStorage.setItem('accessToken', accessToken); // Store in sessionStorage whenever token changes
    } else {
      sessionStorage.removeItem('accessToken'); // Clear from sessionStorage if token is null
    }
    if (csrfToken) {
      sessionStorage.setItem('csrfToken', csrfToken); // Store in sessionStorage whenever token changes
    } else {
      sessionStorage.removeItem('csrfToken'); // Clear from sessionStorage if token is null
    }
  }, [accessToken, csrfToken ]);

  
  return (
    <AuthContext.Provider value={{ accessToken, csrfToken }}>
      {children}
    </AuthContext.Provider>
  );
};

// https://mui.com/joy-ui/integrations/material-ui/
const materialTheme = createTheme();

export default function App() {
  
  return (
   
<ReactRouterAppProvider navigation={NAVIGATION} branding={BRANDING}>
  <ThemeProvider theme={{ [MATERIAL_THEME_ID]: materialTheme }}>
      <JoyCssVarsProvider>
        <CssBaseline enableColorScheme />
          <AuthProvider>
            <Outlet />
        </AuthProvider>
      </JoyCssVarsProvider>
    </ThemeProvider>
</ReactRouterAppProvider>
  );
}