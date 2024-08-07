import Servers from './Servers'
import useSetBreadcrumbs from '../../middleware/useSetBreadcrumbs'
import { useEffect, useState } from 'react'
import breadcrumbs from '../../helpers/constants/breadcrumbs'
import ManageServerModal from '../../components/Servers/ManageServerModal'
import { apiAxios } from '../../helpers/axios'
import { FormInstance, Tag } from 'antd'
import { toast } from 'react-toastify'
import { IEncryptedData, ILinkedIdEnabledDocument } from '../../interfaces/interfaces'
import constants from '../../helpers/constants/constants'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { IStore } from '../../store/store'
import { setServers } from '../../store/slices/serverSlice'

export interface IServer extends ILinkedIdEnabledDocument {
  _id: string
  server_ip_address: string
  ssh_port: number
  admin_username: IEncryptedData
  private_key: IEncryptedData
  server_name: string
  status: string
  server_status: string
}
export interface IViewProps {
  loading: boolean
  columns?: any[]
  servers?: IServer[]
  functions?: {
    [functionName: string]: (...args: any[]) => any
  }
}

const ServersContainer = () => {
  const [loading, setLoading] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [showServerModal, setShowServerModal] = useState(false)
  const servers = useSelector((state: IStore) => state.servers)
  const swarms = useSelector((state: IStore) => state.swarms)
  const { integrations } = useSelector((state: IStore) => state.configData)

  const dispatch = useDispatch()
  const navigate = useNavigate()

  const setBreadcrumbs = useSetBreadcrumbs()

  useEffect(() => {
    setBreadcrumbs(breadcrumbs.SERVERS)
  }, [])

  const getSwarm = (record: IServer) => {
    const dockerLinkedId = record?.linked_ids?.find((linkedIdObj) => linkedIdObj.name === constants.INTEGRATIONS.DOCKER)

    const { integration_id } = dockerLinkedId || {}

    const dockerIntegration = integrations?.docker?.find((integration) => integration._id === integration_id)

    if (!dockerIntegration) return

    const swarm = swarms?.find((swarm) => swarm._id === dockerIntegration?.config?.swarm?.swarm_id)
    const nodeType = dockerIntegration?.config?.swarm?.node_type
    return { swarm, nodeType }
  }
  const columns = [
    {
      title: 'Server Name',
      dataIndex: 'server_name',
      key: 'server_name',
    },
    {
      title: 'Server IP Address',
      dataIndex: 'server_ip_address',
      key: 'server_ip_address',
    },
    {
      title: 'Status',
      dataIndex: 'server_status',
      key: 'server_status',
      render: (text: string) => {
        switch (text) {
          case constants.SERVER_STATUSES.PENDING_INITIALIZATION:
            return <Tag color="orange">Pending Initialization</Tag>
          case constants.SERVER_STATUSES.FAILED_INITIALIZATION:
            return <Tag color="red">Failed Initialization</Tag>
          case constants.SERVER_STATUSES.SUCCESSFUL_INITIALIZATION:
            return <Tag color="green">Ready</Tag>
          default:
            return text
        }
      },
    },
    {
      title: 'Availability',
      dataIndex: 'availability',
      key: 'availability',
      render: (text: string) => {
        switch (text) {
          case constants.AVAILABILITY.ONLINE:
            return <Tag color="green">{constants.AVAILABILITY.ONLINE}</Tag>
          case constants.AVAILABILITY.OFFLINE:
            return <Tag color="red">{constants.AVAILABILITY.OFFLINE}</Tag>

          default:
            return text
        }
      },
    },
    {
      title: 'Swarm',
      render: (_: any, record: IServer) => {
        const { swarm, nodeType } = getSwarm(record) || {}

        const tagColor = nodeType === 'manager' ? 'blue' : 'green'

        return (
          <span>
            {swarm?.name ? (
              <span>
                {swarm?.name} <Tag color={tagColor}>{nodeType}</Tag>
              </span>
            ) : (
              '-'
            )}
          </span>
        )
      },
    },
  ]

  const onManageServer = () => {
    setShowServerModal(true)
  }

  const getServers = async () => {
    setLoading(true)
    const {
      data: { data, success },
    } = await apiAxios.get('/servers')
    if (success) {
      dispatch(setServers(data?.servers))
    }
    setLoading(false)
  }
  const testConnection = async (values: any, form: FormInstance) => {
    setTestingConnection(true)
    const { data } = await apiAxios.post('/servers/test-connection', values)
    if (data?.success && data?.data?.success) {
      toast.success('Connection successful')
      setTestingConnection(false)
      return true
    }
    const { error } = data?.data?.data || {}
    switch (error) {
      case 'Missing required params':
        const missingParams = data?.data?.data?.missingParams
        const errorFieldObj = (missingParams || []).map((param: string) => ({
          name: [param],
          errors: ['Required'],
        }))
        form.setFields(errorFieldObj)
        toast.error('Connection test failed: ' + missingParams.join(', '))
        break
    }

    setTestingConnection(false)
  }
  const onSave = async (values: any, form: FormInstance) => {
    setLoading(true)
    const connectionTestResult = await testConnection(values, form)
    if (!connectionTestResult) return // Do somethign here re error
    const {
      data: { success },
    } = await apiAxios.post('/servers', values)
    if (success) {
      toast.success('Server created successfully')
      await getServers()
      setShowServerModal(false)
    }

    setLoading(false)
  }

  const onRow = (record: IServer) => ({
    onClick: () => {
      navigate(`/servers/${record?._id}`)
    },
  })

  const viewProps: IViewProps = {
    loading,
    columns,
    servers: servers,
    functions: {
      onManageServer,
      onRow,
    },
  }

  const manageServerProps = {
    onCancel: () => {
      setShowServerModal(false)
    },
    testConnection,
    open: showServerModal,
    onSave,
    loading: loading || testingConnection,
    swarms,
  }

  return (
    <>
      <Servers {...viewProps} />
      <ManageServerModal {...manageServerProps} />
    </>
  )
}

export default ServersContainer
