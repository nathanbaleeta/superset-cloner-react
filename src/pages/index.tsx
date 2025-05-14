import React, { Fragment, useEffect, useState, useContext } from "react";
import { Link, useNavigate , useLocation} from 'react-router';

import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import CircularProgress from '@mui/material/CircularProgress';

import Card from '@mui/joy/Card';
import CardContent from '@mui/joy/CardContent';
import Typography from '@mui/joy/Typography';

import CircularProgressJoy from '@mui/joy/CircularProgress';
import SvgIcon from '@mui/joy/SvgIcon';

import CardActions from '@mui/joy/CardActions';
import Button from '@mui/joy/Button';

import { AuthContext } from "../App"

import JSZip from "jszip";
import yaml from 'js-yaml'; 
import fs from "fs";


const useAuth = () => useContext(AuthContext);

export default function HomePage() {
  const { accessToken, csrfToken } = useAuth();
  let navigate = useNavigate();

  // API host credentials & Endpoints
const SUPERSET_ENDPOINT: string = import.meta.env.VITE_SUPERSET_ENDPOINT; 
const DASHBOARD_API_ENDPOINT: string = `${SUPERSET_ENDPOINT}/api/v1/dashboard/`
const DATASET_API_ENDPOINT: string = `${SUPERSET_ENDPOINT}/api/v1/dataset/`


   // React hooks
  const [dashboards, setDashboards] = useState([]);  
  const [isLoading, setIsLoading] = useState(false);
  const [dashboardTitle, setDashboardTitle] = useState(""); 
  const [datasetList, setDatasetList] = useState([]); 
  const [sliceConfigMap, setSliceConfigMap] = useState([] as any);

  /**
* *********************************************************************************
*  RETRIEVE DASHBOARDS
* **********************************************************************************
*/

const getDashboards = async () => {
  // Hint: https://stackoverflow.com/questions/46915002/argument-of-type-string-null-is-not-assignable-to-parameter-of-type-string
  sessionStorage.setItem('access_token', accessToken);
  let ACCESS_TOKEN = sessionStorage.getItem('access_token') as string
  
  sessionStorage.setItem('csrf_token', csrfToken);
  let CSRF_TOKEN = sessionStorage.getItem('csrf_token') as string

  setIsLoading(true);

  const dashboardGetResponse = await fetch(DASHBOARD_API_ENDPOINT, {
    method: 'GET',
    mode: 'cors',
    credentials: "same-origin",
    headers: {
      'Accept': 'application/json',
      Authorization: 'Bearer ' + ACCESS_TOKEN,
      'X-CSRFToken': CSRF_TOKEN 
    }
  })

  const dashboardData = await dashboardGetResponse.json();
  
  const dashboardListing = dashboardData['result']

  setDashboards(dashboardListing)
  setIsLoading(false);

   if (!dashboardListing) {
      console.warn("Dashboard listing missing from response. Check if the Superset API has been changed.");   
   }
  
  return dashboardListing;
}

const getDatasets = async () => {
  sessionStorage.setItem('access_token', accessToken);
  let ACCESS_TOKEN = sessionStorage.getItem('access_token') as string
  
  sessionStorage.setItem('csrf_token', csrfToken);
  let CSRF_TOKEN = sessionStorage.getItem('csrf_token') as string

  const datasetGetResponse = await fetch(DATASET_API_ENDPOINT, {
    method: 'GET',
    mode: 'cors',
    credentials: "same-origin",
    headers: {
      'Accept': 'application/json',
      Authorization: 'Bearer ' + ACCESS_TOKEN,
      'X-CSRFToken': CSRF_TOKEN 
    }
  })
  const datasetData = await datasetGetResponse.json();
  const datasetListing = datasetData['result']

  if (!datasetListing) {
    console.warn("Dataset listing missing from response. Check if the Superset API has been changed.");   
  }
  setDatasetList(datasetListing)

return datasetListing;
}

const getDashboardDetails = async (dashboardId: number) => {
  sessionStorage.setItem('access_token', accessToken);
  let ACCESS_TOKEN: string | null = sessionStorage.getItem('access_token') 

  sessionStorage.setItem('csrf_token', csrfToken);
  let CSRF_TOKEN = sessionStorage.getItem('csrf_token') as string
  
  let arrayBufferResponse: any
  if (dashboardId >= 0) {
    const response = await fetch(`${DASHBOARD_API_ENDPOINT}export/?q=!(${dashboardId})`, {
      method: 'GET',
      mode: 'cors',
      credentials: "same-origin",
      headers: new Headers({
        'accept': 'application/zip',
        Authorization: 'Bearer ' + ACCESS_TOKEN,
        'X-CSRFToken': CSRF_TOKEN
      })
    })
    
    // Converts the response stream into an ArrayBuffer, which is the preferred format for binary data in JavaScript.
    arrayBufferResponse = await response.arrayBuffer() 
  } else {
      console.log(`Error: No dashboard with title '${dashboardId}' found.`);
  }
  return arrayBufferResponse
}

// Get source dashboard name
const getSourceDashboardName = (dashboardData: {dashboard_title: string}): string => {
  const dashboardName: string = dashboardData.dashboard_title;

  if (!dashboardName) {
      throw new Error(`Dashboard name not found in ${JSON.stringify(dashboardData)}!`);
  }
  return dashboardName;
}

const onDatasetListSearch = (datasourceId: any) => {
  const foundDataset: any = datasetList?.find((element: any) => element.id === datasourceId);
  const datasourceName = foundDataset['table_name'] || ""
  return datasourceName
}

const extractSliceInfoFromZip = async (arrayBuffer: any) => {
    const zip = new JSZip();
    const content = await zip.loadAsync(arrayBuffer); // Loads the ZIP file data into the JSZip instance asynchronously.
    const fileNames = Object.keys(content.files);
    
    const dashboardFileMatches: any = fileNames.find(s => s.includes('dashboards'));
    const yamlDashboardString: any = await content.file(dashboardFileMatches)!.async("string");
    const dashboardData = yaml.load(yamlDashboardString)

    if (!dashboardData) {
      throw new Error(`Dashboard data not found in ${fileNames[3]}!`);
    }

    const sourceDashboardName = getSourceDashboardName(dashboardData);
    setDashboardTitle(sourceDashboardName)

    // Search through zipped archive file for chart assets
    const chartFileMatches = fileNames.filter(s => s.includes('charts'));

    let configInfoMap: any = []

    for (let [file, value] of Object.entries(chartFileMatches)) {
      const yamlChartString: any = await content.file(chartFileMatches[file])!.async("string");
      const chartData = yaml.load(yamlChartString)

      // Extract sliceName & sliceId
      let sourceSliceName = chartData.slice_name
      let uuid = chartData.uuid
      let datasourceId: number = parseInt(chartData.params.datasource)

      // Search for matching dataset name from dataset react hook state
      let datasourceName = await onDatasetListSearch(datasourceId)
      
      configInfoMap[file] = {};
      configInfoMap[file].uuid = uuid
      configInfoMap[file].sourceChart = sourceSliceName;
      configInfoMap[file].destinationChart = '';
      configInfoMap[file].dataset = datasourceName;
    }
    setSliceConfigMap(configInfoMap);
    return [sourceDashboardName, configInfoMap, dashboardData]
}

const onClickDoSomething = async (dashboardId: number) => {
  const initialDatasets = datasetList
  const arrayBuffer = await getDashboardDetails(dashboardId)
  const [sourceDashboardTitle, chartConfigInfoMap, dashboardData] = await extractSliceInfoFromZip(arrayBuffer)

  navigate( `dashboard/${dashboardId}`, { state: { 
    initialDatasets, sourceDashboardTitle, chartConfigInfoMap, dashboardData
  } })
}

useEffect(() => { 
  getDashboards();
  getDatasets();
}, [DASHBOARD_API_ENDPOINT, DATASET_API_ENDPOINT, accessToken, csrfToken]);
  

  return (   
   <Fragment>
{isLoading ? <Box sx={{ top: 0,
                     left: 0,
                     bottom: 0,
                     right: 0,
                     position: 'absolute',
                     display: 'flex',
                     alignItems: 'center',
                     justifyContent: 'center' }}>
       <CircularProgress color="secondary" size="25px" />
     </Box> : null}

    <Container maxWidth={false} >
    <br/>
    
    <Box
      sx={{
        width: '100%',
        //maxWidth: 700,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 6,
      }}
    >
      
      {dashboards?.map(({id, dashboard_title, status, changed_on_delta_humanized, owners}: any)=>
    <div key={id}>
      <Card variant="solid" color="primary" invertedColors>
      <CardContent orientation="horizontal" sx={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        
        <CircularProgressJoy size="lg" determinate value={30} >
          <SvgIcon >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"
              />
            </svg>
          </SvgIcon>
        </CircularProgressJoy>

        </CardContent>
       
        <CardContent>
          <Typography level="h4" noWrap>{dashboard_title}</Typography>
         <Typography level="body-md" sx={{textTransform: 'capitalize'}}>{status}</Typography>
         
          <Typography level="body-xs">{changed_on_delta_humanized}</Typography>
        </CardContent>
    
        <CardActions>
        <Button variant="outlined" size="sm" sx={{ color: '#FFAE42'}}
          onClick={() => onClickDoSomething(id)}>
          Visit Details
        </Button>
      </CardActions>  
    </Card>

    </div>
    )}
    </Box>
    
</Container>
</Fragment>
 
  );
}
