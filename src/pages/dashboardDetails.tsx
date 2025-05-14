import React, { Fragment, useState, useContext } from "react";
import { useParams, useLocation } from "react-router"

import Box from '@mui/joy/Box';
import Typography from '@mui/joy/Typography';
import Card from '@mui/joy/Card';
import CardContent from '@mui/joy/CardContent';
import Table from '@mui/joy/Table';
import Divider from '@mui/joy/Divider';
import Sheet from '@mui/joy/Sheet';
import Input from '@mui/joy/Input';
import Button from '@mui/joy/Button';
import ButtonGroup from '@mui/joy/ButtonGroup';
import AddIcon from '@mui/icons-material/Add';
import Select, { selectClasses } from '@mui/joy/Select';
import Option from '@mui/joy/Option';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';

import { AuthContext } from "../App"

const useAuth = () => useContext(AuthContext);

// API host credentials & Endpoints
const SUPERSET_ENDPOINT: string = import.meta.env.VITE_SUPERSET_ENDPOINT; 
const DASHBOARD_API_ENDPOINT: string = `${SUPERSET_ENDPOINT}/api/v1/dashboard/`
const DATASET_API_ENDPOINT: string = `${SUPERSET_ENDPOINT}/api/v1/dataset/`
const CHART_API_ENDPOINT: string = `${SUPERSET_ENDPOINT}/api/v1/chart/`

export default function DashboardDetailsPage() {
  const params = useParams()
  const dashboardId: number = Number(params.id)

  const { state } = useLocation(); 
  const { initialDatasets, sourceDashboardTitle, chartConfigInfoMap, dashboardData } = state;

  const { accessToken, csrfToken } = useAuth();

  const [sliceConfigMap, setSliceConfigMap] = useState(chartConfigInfoMap as any);
  const [dashboardDataYaml, setDashboardDataYaml] = useState(dashboardData as any);
  const [editingRow, setEditingRow] = useState(null);
  const [editedValues, setEditedValues] = useState({});
  const [datasetList, setDatasetList] = useState(initialDatasets as any);
  const [oldDashboardTitle, setOldDashboardTitle] = useState(sourceDashboardTitle);  
  const [newDashboardTitle, setNewDashboardTitle] = useState("");  

  const handleEdit = (uuid) => {
    setEditingRow(uuid);
    // Initialize editedValues with the current row's data for easy reverting
    const rowToEdit = sliceConfigMap?.find(item => item.uuid === uuid);
    setEditedValues(rowToEdit ? {...rowToEdit} : {}); //spread operator ensures a copy
  };

  const handleInputChange = (event, uuid, field) => {
    setEditedValues({
      ...editedValues,
      [field]: event.target.value,
    });
  };

  const handleSelectChange = (uuid: any, datasourceId: any) => {
    setEditedValues({
      ...editedValues,
      dataset: datasourceId
    });
  }

  const handleSave = (uuid) => {
    const updatedSliceConfigMapData = sliceConfigMap?.map((item) =>
      item.uuid === uuid ? { ...item, ...editedValues } : item
    );

    setSliceConfigMap(updatedSliceConfigMapData);
    setEditingRow(null);
    setEditedValues({}); // Clear editedValues after saving

  };

  const handleCancel = (uuid) => {
    setEditingRow(null);
    setEditedValues({}); // Clear editedValues after cancel
  };

  const arrayDatasetItems = datasetList?.map(({uuid, table_name}: any) => 
    <Option key={uuid} value={table_name}>{table_name}</Option> 
 )

 /********************************************************************************************************/
 /*                                  CREATE DASHBOARD                                                    */
 /********************************************************************************************************/
// Creating an empty dashboard
const onCreateEmptyDasboard = async () => { 
  const randomString = (Math.random() + 1).toString(36).substring(7);

  const source_dashboard_name = oldDashboardTitle
  const new_dashboard_name = `${newDashboardTitle} ${randomString}`

  sessionStorage.setItem('access_token', accessToken);
  let ACCESS_TOKEN = sessionStorage.getItem('access_token') as string
  
  sessionStorage.setItem('csrf_token', csrfToken);
  let CSRF_TOKEN = sessionStorage.getItem('csrf_token') as string

  const getDashboardResponse = await fetch(DASHBOARD_API_ENDPOINT, {
    method: 'GET',
    mode: 'cors',
    credentials: "same-origin",
    headers: new Headers({
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + ACCESS_TOKEN,
      'X-CSRFToken': CSRF_TOKEN
    })
  })
  const dashboardResponse = await getDashboardResponse.json();
  const dashboards = dashboardResponse['result']
  
  let dashboard_data: any = {};

  dashboard_data = dashboards.find(item => item.dashboard_title.toLowerCase() === source_dashboard_name.toLowerCase());
  
  if (!Object.keys(dashboard_data).length) throw new Error(`Source dashboard name '${source_dashboard_name}' not found!`);
  
  // created_on_delta_humanized - This field was missing in the earlier API when orginal script created
  // tags - This field was added in Superset 3.0.2
  const keys_to_remove = ['changed_by', 'changed_by_name', 'changed_by_url', 
                          'changed_on_delta_humanized', 'created_on_delta_humanized', 
                          'changed_on_utc', 'created_by', 'id', 'status', 'thumbnail_url',
                           'url', 'roles', 'tags'
                        ];

  keys_to_remove.forEach(key => delete dashboard_data[key]);

  dashboard_data['dashboard_title'] = new_dashboard_name;
  
  dashboard_data['slug'] = new_dashboard_name.toLowerCase().replace(/ /g, "-");

  if (!dashboard_data.css) {
        dashboard_data.css = "";
  }

  dashboard_data['owners'] = dashboard_data.owners.map(owner => owner.id);
  
  const create_dashboard_post_response = await fetch(DASHBOARD_API_ENDPOINT, {
    method: 'POST',
    mode: 'cors',
    credentials: "same-origin",
    headers: new Headers({
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + ACCESS_TOKEN,
      'X-CSRFToken': CSRF_TOKEN
    }),
    body: JSON.stringify(dashboard_data),
  })

  let dashboard_post_response = await create_dashboard_post_response.json();
  let dashboardId = dashboard_post_response['id']

  console.info(dashboardId)

  /* if (!dashboardId) {
    throw new Error("Dashboard ID missing from response. Check if the Superset API has been changed.");
  } */
  return dashboardId
 }

 /********************************************************************************************************/
 /*                             CREATE CHARTNAME TO ID MAP                                               */
 /********************************************************************************************************/

 // Create sliceName to ID map
 const createChartNameToIdMap = (dashboardData: any) => {
  const dashboardName = dashboardData.dashboard_title;

  if (!dashboardName) {
    throw new Error(`Dashboard name not found in ${JSON.stringify(dashboardData)}!`);
  }

  const chartList = dashboardData.position;

  if (!chartList) {
    throw new Error(`List of charts not found in ${dashboardName}!`);
  }

  // regex pattern
  const pattern = /^CHART-/;
  // Using pattern matching & filter to extract charts info

  const chartFilteredKeys = Object.keys(chartList).filter(x => pattern.test(x));

  // apply selective filtering to chart list dictionary to drop non chart info
  const result = chartFilteredKeys.filter(i => i in chartList).map(i => chartList[i]);

  // convert filtered chart list back to object for parsing
  const chartFilteredDict = Object.fromEntries(result.map((item, index) => [index, item]));

  const chartFilteredList = Object.keys(chartFilteredDict);

  const chartNameToIdMap = {};

  // Iterate through nested dictionary to extract useful chart values 
  for (const chart of chartFilteredList) { 
    const chartName = chartFilteredDict[chart].meta.sliceName; 
    chartNameToIdMap[chartName] = chartFilteredDict[chart].meta.chartId; 
  }

  return chartNameToIdMap;
 }


 /********************************************************************************************************/
 /*                                      CREATE DATASET INFO MAP                                         */            
 /********************************************************************************************************/

// Create dataset info map
const createDatasetInfoMap = async () => {
  sessionStorage.setItem('access_token', accessToken);
  let ACCESS_TOKEN = sessionStorage.getItem('access_token') as string
  
  sessionStorage.setItem('csrf_token', csrfToken);
  let CSRF_TOKEN = sessionStorage.getItem('csrf_token') as string

  const params = {
    q: JSON.stringify({
        columns: ["id", "table_name", "datasource_type"],
        page: 0,
        page_size: 1000
    })
  };

  const queryParams = new URLSearchParams(params);
  const DATASET_QUERY_ENDPOINT = `${DATASET_API_ENDPOINT}?${queryParams}`;

  const getDatasetResponse = await fetch(DATASET_QUERY_ENDPOINT, {
    method: 'GET',
    mode: 'cors',
    credentials: "same-origin",
    headers: {
      'Accept': 'application/json',
      Authorization: 'Bearer ' + ACCESS_TOKEN,
      'X-CSRFToken': CSRF_TOKEN 
    }
  })
  const datasetResponse = await getDatasetResponse.json();
  const datasets = datasetResponse['result']

  if (!datasets) {
    throw new Error("List of datasets not found! Check if Superset API has been changed.");
  }

  const datasetInfoMap = {};

  for (const dataset of datasets) {
    const datasetName = dataset.table_name;
    datasetInfoMap[datasetName] = {
        id: dataset.id,
        type: dataset.datasource_type
    };
  }

  return datasetInfoMap;

}

 /********************************************************************************************************/
 /*                                      CREATE CHART_ID TO CHART_INFO MAP                               */            
 /********************************************************************************************************/

 const createChartIdToChartInfoMap = (chartNameToIdMap, datasetInfoMap, sliceConfigMap) => {
  const chartIdToChartInfoMap = {};
  for (const [chartName, chartInfo] of Object.entries(sliceConfigMap) as any) {
    const chartId = chartNameToIdMap[chartName];
    const datasetName = chartInfo["dataset"];

    if (datasetInfoMap[datasetName]) {
        chartIdToChartInfoMap[chartId] = JSON.parse(JSON.stringify(datasetInfoMap[datasetName]));
    } else {
        throw new Error(`Cannot find dataset '${datasetName}' for chart '${chartName}'Please check if the 
                  dataset name provided in the config file '${JSON.stringify(sliceConfigMap)}' is correct.`);
    }

    //const newChartName = chartInfo.new_chart_name || `chart-${chartId}`;
    const newChartName = chartName
    chartIdToChartInfoMap[chartId]["new_chart_name"] = newChartName;
    
  }
  return chartIdToChartInfoMap;
}

 /********************************************************************************************************/

 const transformSliceConfigMap = (data: any) => {

  const transformedData = data.reduce((accumulator, currentItem) => {
    const { sourceChart, ...rest } = currentItem; // Destructure sourceChart and the remaining properties
    accumulator[sourceChart] = rest; // Assign the remaining properties to the sourceChart key in the accumulator
    return accumulator;
  }, {}); // Initialize the accumulator as an empty object

  return transformedData
 }


 /********************************************************************************************************/
 /*                                      GET CHART DETAILS & CHANGE CHART DETAILS                        */            
 /********************************************************************************************************/
 
const getChartDetails = async (originChartId) => {
  let ACCESS_TOKEN = sessionStorage.getItem('access_token')
  let CSRF_TOKEN = sessionStorage.getItem('csrf_token')

  const CHART_DETAILS_ENDPOINT = `${CHART_API_ENDPOINT}${originChartId}`; 

  const chartGetResponse = await fetch(CHART_DETAILS_ENDPOINT, {
    method: 'GET',
    mode: 'cors',
    credentials: "same-origin",
    headers: {
      'Accept': 'application/json',
      Authorization: 'Bearer ' + ACCESS_TOKEN,
      'X-CSRFToken': CSRF_TOKEN 
    } as any
  })

  const chartDetailsRequest = await chartGetResponse.json();
  const chartDetails = chartDetailsRequest['result']

   if (!chartDetails) {
      console.warn("Chart details missing from response. Check if the Superset API has been changed.");   
   }
  
  const keysToRemove = [
      'thumbnail_url', 
      'url', 
      'id', 
      'changed_on_delta_humanized', 
      'owners', 
      'tags' // This field was added in Superset 3.0.2
  ];

  keysToRemove.forEach(key => {
      delete chartDetails[key];
  });

  return chartDetails;
}

const changeChartDetails = (chart_details, dashboardId, newChartName) => {
  const queryContext = JSON.parse(chart_details.query_context);
  const datasourceId = queryContext.datasource.id // 45
  const datasourceType =  queryContext.datasource.type // 'table'
  //console.info(datasourceId, datasourceType)
  
  chart_details.dashboards[0] = dashboardId; 
  chart_details.datasource_id = datasourceId;
  chart_details.datasource_type = datasourceType;
  chart_details.slice_name = newChartName;
  
  //console.info(chart_details)
  return chart_details;
  }
 /********************************************************************************************************/
 /*                                      CREATE CHART                                                    */            
 /********************************************************************************************************/
 
 const onCreateChart = async (orginChartId, dashboardId, datasetId, datasetType, newChartName) => {

  sessionStorage.setItem('access_token', accessToken);
  let ACCESS_TOKEN = sessionStorage.getItem('access_token') as string
  
  sessionStorage.setItem('csrf_token', csrfToken);
  let CSRF_TOKEN = sessionStorage.getItem('csrf_token') as string

  const chartDetails = await getChartDetails(orginChartId);
  const newChartDetails = await changeChartDetails(chartDetails, dashboardId, newChartName);
  
  const create_chart_post_response = await fetch(CHART_API_ENDPOINT, {
    method: 'POST',
    mode: 'cors',
    credentials: "same-origin",
    headers: new Headers({
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + ACCESS_TOKEN,
      'X-CSRFToken': CSRF_TOKEN
    }),
    body: JSON.stringify(newChartDetails),
  })

  const chart_post_response = await create_chart_post_response.json();
  const chartId = chart_post_response['id']

  if (!chartId) {
    console.warn("Chart ID not found upon creation. Check if the Superset API has been changed.");
  }

  return chartId;
}


 /********************************************************************************************************/
 /*                                      RETAIN CHART POSITIONS                                          */            
 /********************************************************************************************************/

 // Change chart position json data
const changePositionJson = (dashboardInfo, alteredPositionJson) => {
  const putRequestBody: any = {};
  putRequestBody.certification_details = dashboardInfo.certification_details;
  putRequestBody.certified_by = dashboardInfo.certified_by;
  putRequestBody.css = dashboardInfo.css;
  putRequestBody.dashboard_title = dashboardInfo.dashboard_title;
  putRequestBody.json_metadata = dashboardInfo.json_metadata;
  putRequestBody.owners = dashboardInfo.owners.map(owner => owner.id);
  putRequestBody.published = dashboardInfo.published;
  putRequestBody.roles = dashboardInfo.roles;
  putRequestBody.slug = dashboardInfo.slug;
  putRequestBody.position_json = alteredPositionJson;

  return putRequestBody;
}

// Retain chart positions
const retainChartPositions = async (dashboardId, chartIdMap) => {
  sessionStorage.setItem('access_token', accessToken);
  let ACCESS_TOKEN = sessionStorage.getItem('access_token') as string
  
  sessionStorage.setItem('csrf_token', csrfToken);
  let CSRF_TOKEN = sessionStorage.getItem('csrf_token') as string

  let chart_key, chart_value;
  for (const [key, value] of Object.entries(chartIdMap)) {
      chart_key = key;
      chart_value = value;
  }

  const DASHBOARD_DETAILS_ENDPOINT = `${DASHBOARD_API_ENDPOINT}${dashboardId}`;

  // https://github.com/apache/superset/issues/25890
  const getDashboardResponse = await fetch(DASHBOARD_DETAILS_ENDPOINT, {
    method: 'GET',
    mode: 'cors',
    credentials: "same-origin",
    headers: {
      'Accept': 'application/json',
      'Authorization': 'Bearer ' + ACCESS_TOKEN
    }
  })
  const dashboardResponse = await getDashboardResponse.json();
  const dashboardInfo = dashboardResponse['result']
  
  if (!dashboardInfo) {
    throw new Error(`Dashboard info for dashboard with id ${dashboardId} not found!`);
  }

  const positionJsonstr = dashboardInfo.position_json;
  if (!positionJsonstr) {
        throw new Error(`position_json not found in response. Exiting.`);
  }

  let positionJsonDict = JSON.parse(positionJsonstr);
  
  for (const [key, value] of Object.entries(positionJsonDict) as any) {
    if (
        //typeof value === 'object' && value !== null && value.hasOwnProperty('meta') && value.meta.hasOwnProperty('chartId')  
        typeof value === 'object' && value.hasOwnProperty('meta') && value.meta.hasOwnProperty('chartId') && value.meta.chartId === parseInt(chart_key)
      ) {
        const old_chart_id = value.meta.chartId;
        //console.info(value.meta);
        value.meta.chartId = chartIdMap[old_chart_id];
    }
  }
  //console.info(positionJsonDict)
  
  const alteredPositionJson = JSON.stringify(positionJsonDict);
  const putRequestPayload = changePositionJson(dashboardInfo, alteredPositionJson);

  const putDashboardResponse = await fetch(`${DASHBOARD_API_ENDPOINT}${dashboardId}`, {
    method: 'PUT',
    mode: 'cors',
    credentials: "same-origin",
    headers: new Headers({
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + ACCESS_TOKEN,
      'X-CSRFToken': CSRF_TOKEN
    }),
    body: JSON.stringify(putRequestPayload),
  })
  console.info(putDashboardResponse)

  return putDashboardResponse;
}

 /********************************************************************************************************/

 const onSubmit = async (e: any) => {
  e.preventDefault()
  let destinationDashboardTitle = newDashboardTitle
  let configMap = sliceConfigMap
  let dashboardData = dashboardDataYaml

  // Create empty dashboard
  const dashboardId = await onCreateEmptyDasboard();

  // Create name to id map
  const chartNameToIdMap = createChartNameToIdMap(dashboardData);

  const datasetInfoMap = await createDatasetInfoMap();
  //console.info(datasetInfoMap)

  const transformedConfigMap = transformSliceConfigMap(configMap)

  const chartIdToChartInfoMap = createChartIdToChartInfoMap(chartNameToIdMap, datasetInfoMap, transformedConfigMap)
  //console.info(chartIdToChartInfoMap)

  let oldChartIdToDupIdMap = {};

  for (let chartId in chartIdToChartInfoMap) {
    let datasetId = chartIdToChartInfoMap[chartId]["id"];
    let datasetType = chartIdToChartInfoMap[chartId]["type"];
    let newChartName = chartIdToChartInfoMap[chartId]["new_chart_name"];
   
    let newChartId = await onCreateChart(chartId, dashboardId, datasetId, datasetType, newChartName);
    console.info(`Chart '${newChartName}' with ID - ${newChartId} created!\n`);

    oldChartIdToDupIdMap[chartId] = newChartId;
    retainChartPositions(dashboardId, oldChartIdToDupIdMap);
  }

}

  return (
    <Fragment>
    <Box
      sx={{
        width: '100%',
        //maxWidth: 500,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 2,
        paddingBottom: 2
      }}
    > 
      <Card variant="solid">
        <CardContent>
          <Typography level="title-md" textColor="inherit">
            Step #1
          </Typography>
          <Typography textColor="inherit">Enter new dashboard name in textbox below </Typography>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography level="title-md" textColor="inherit">
            Step #2
          </Typography>
          <Typography textColor="inherit">Click on the old chart to copy the text and paste in new chart text box then edit ...</Typography>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography level="title-md" textColor="inherit">
            Step #3
          </Typography>
          <Typography textColor="inherit">Select the preferred dataset</Typography>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography level="title-md" textColor="inherit">
            Step #4
          </Typography>
          <Typography textColor="inherit">
            Hit save to run the workflow to clone the dashboard
            </Typography>
        </CardContent>
      </Card>
     </Box>

     <form onSubmit={onSubmit}>
    <>
     <p>
     <Input
          sx={{ '--Input-decoratorChildHeight': '45px' }}
          placeholder="Destination dashboard name"
          onChange={(e: any) => setNewDashboardTitle(e.target.value)}
          required
          variant="outlined"
          size="lg"
          value={newDashboardTitle}
          endDecorator={
            <Button
              variant="soft" 
              //variant="soft"
              color="primary"
              sx={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
            >
              Enter New Dashboard
            </Button>}
            />
     </p>
     </>

      <Sheet 
      variant="outlined"
      sx={{ width: '100%', boxShadow: 'sm', borderRadius: 'sm', marginTop: 5 }}>
        <Typography  gutterBottom
            sx={{ flex: '1 1 100%', marginLeft:2, marginTop: 1 }}
            id="tableTitle"
          >
            <div>
              <p>
                <Typography level="title-md" 
                // sx={{ fontSize: 'lg', mb: 0.5, paddingRight: 2 }} 
                sx={{ fontSize: 'lg', lineHeight: 1, alignItems: 'flex-start' }}
                textColor="primary.700">
                  Source Dashboard Title: 
                </Typography>
                <Typography
                    variant="soft"
                    color="primary"
                    sx={{ fontSize: 'sm', '--Typography-gap': '0.5rem', p: 1 }}
                  >
               {oldDashboardTitle} 
              </Typography>
                </p>
              </div>
              <div>
                <p>
                <Typography level="title-md" 
                //sx={{ fontSize: 'md', mb: 0.5, paddingRight: 2 }} 
                sx={{ fontSize: 'lg', lineHeight: 1, alignItems: 'flex-start' }}
                textColor="primary.700">
                  Destination Dashboard Title: 
                </Typography>
                <Typography
                 variant="soft"
                 color="success"
                 sx={{ fontSize: 'sm', '--Typography-gap': '0.5rem', p: 1 }}>
                {newDashboardTitle} 
                </Typography>
                </p>
              </div>
              <div>
                <p>
                <Button onClick={onSubmit} color="primary">
                    Clone Dashboard
                </Button>
                </p>
              </div>
          </Typography>
      <Table aria-label="table variants" variant="outlined" size="lg">
      <thead>
        <tr>
          <th style={{ width: '25%' }}>Source Chart</th>
          <th style={{ width: '35%' }}>Destination Chart</th>
          <th style={{ width: '25%' }}>Dataset</th>
          <th style={{ width: '15%' }}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {sliceConfigMap?.map((item) => (
          <tr key={item.uuid}>
            {editingRow === item.uuid ? (
              <>
                <td>
                  <Typography variant="soft"
                    color="primary"
                    sx={{ fontSize: 'sm', '--Typography-gap': '0.5rem', p: 1 }}>
                    {item.sourceChart}</Typography>
                </td>
                <td>
                  <Input
                    //color="primary"
                    sx={{ '--Input-focused': 1 }}
                    type="text"
                    size="md" 
                    fullWidth
                    value={editedValues.destinationChart || ''}// Use editedValues
                    onChange={(event) => handleInputChange(event, item.uuid, 'destinationChart')}
                  />
                </td>
                <td>
                <Box sx={{ width: 270 }}>
                   <Select
                    defaultValue={editedValues.dataset}
                    placeholder="Choose dataset…" 
                    onChange={(e: any, newValue) => handleSelectChange(item.uuid, newValue )}
                    slotProps={{
                      listbox: {
                        placement: 'bottom-start',
                        sx: { minWidth: 160 },
                      },
                    }}
                    indicator={<KeyboardArrowDown />}
                    sx={{
                      //width: 240,
                      [`& .${selectClasses.indicator}`]: {
                        transition: '0.2s',
                        [`&.${selectClasses.expanded}`]: {
                          transform: 'rotate(-180deg)',
                        },
                      },
                    }}
                    size="md">
                    {arrayDatasetItems}
                  </Select> 
                  </Box>
                </td>
              </>
            ) : (
              <>
                <td>
                   <Typography 
                   //variant="soft"
                   //color="primary"
                   sx={{ fontSize: 'sm', '--Typography-gap': '0.5rem', p: 1 }}
                    textColor="primary.700" >
                      {item.sourceChart}
                </Typography>
               </td>
                <td> 
                  <Input
                    disabled
                    type="text"
                    size="sm" 
                    value={item.destinationChart}
                  />
                </td>
                <td>
                <Select 
                    disabled
                    defaultValue={item.dataset}
                    //value={item.dataset}
                    placeholder="Choose dataset…" 
                    size="sm"
                   >
                   {datasetList?.map(({uuid, table_name}: any) => 
                        <Option key={uuid} value={table_name}>{table_name}</Option> 
                    )}
                  </Select> 
                </td>
              </>
            )}
            <td>
              {editingRow === item.uuid ? (
                <>
                  <ButtonGroup
                    aria-label="radius button group"
                    sx={{ '--ButtonGroup-radius': '40px' }}
                    color="primary"
                    size="sm"
                    variant="solid"
                  >
                  <Button 
                    startDecorator={<AddIcon />}
                    variant="soft" 
                    size="sm"
                    onClick={() => handleSave(item.uuid)}>Add</Button>
                  <Button 
                  variant="solid"
                  onClick={() => handleCancel(item.uuid)}>Cancel</Button>
                </ButtonGroup>
                </>
              ) : (
                <ButtonGroup
                    aria-label="radius button group"
                    sx={{ '--ButtonGroup-radius': '40px' }}
                    color="primary"
                    size="sm"
                    variant="outlined"
                  >
                     <Button 
                      variant="soft" 
                      size="sm" 
                      onClick={() => handleEdit(item.uuid)}>Edit</Button>
                  </ButtonGroup>
               
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
      </Sheet>
      </form>
     </Fragment>
  )
}