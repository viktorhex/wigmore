import './App.css'
import BarChart from './BarChart'

function App() {
  const rawData = [10, '20', undefined, 30, '40', null, 50];

  const cleanData = rawData
    .filter((d): d is number | string => d !== undefined && d !== null)
    .map(d => +d)
    .filter(d => !isNaN(d));

  return (
    <>
      <BarChart data={cleanData} />
    </>
  )
}

export default App
