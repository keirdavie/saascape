import { useEffect } from "react"
import Aside from "./components/Aside"
import Header from "./components/Header"
import { apiAxios } from "./helpers/axios"
import Main from "./pages/Main"
import { useDispatch } from "react-redux"
import { setConfigData } from "./store/slices/configData"

const MainLayout = () => {
  const dispatch = useDispatch()
  useEffect(() => {
    getIntegrations()
  }, [])
  const getIntegrations = async () => {
    const {
      data: { success, data },
    } = await apiAxios.get("/integrations")
    if (success) {
      const { integrations, enabledIntegrations } = data
      dispatch(setConfigData({ integrations, enabledIntegrations }))
    }
  }

  return (
    <div className='main-layout'>
      <Header />
      <Aside />
      <Main />
    </div>
  )
}

export default MainLayout
