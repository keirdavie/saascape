/*
 * Copyright SaaScape (c) 2024.
 */

import { Link, useNavigate, useParams } from 'react-router-dom'
import { IApplicationProps } from '../ApplicationRouteHandler'
import ViewInstance from './ViewInstance'
import useSetBreadcrumbs from '../../../middleware/useSetBreadcrumbs'
import { useEffect, useState } from 'react'
import breadcrumbs from '../../../helpers/constants/breadcrumbs'
import { useDispatch, useSelector } from 'react-redux'
import { IStore } from '../../../store/store'
import IInstance, { InstanceServiceStatus } from 'types/schemas/Instances'
import { apiAxios, apiAxiosToast } from '../../../helpers/axios'
import { Popconfirm, TabsProps } from 'antd'
import Icon from '../../../components/Icon'
import EnvironmentConfig from '../../../components/Applications/configuration/EnvironmentConfig'
import SecretsConfig from '../../../components/Applications/configuration/SecretsConfig'
import InstanceOverview from '../../../components/Applications/Instances/InstanceOverview'
import SideFullMenu from '../../../components/SideFullMenu.tsx'
import EditInstanceMenu from '../../../components/Applications/Instances/EditInstanceMenu.tsx'
import { IMenuContainerRef, useMenuContainer } from '../../../components/MenuContainer.tsx'
import VersionSelectionModal from '../../../components/Applications/Instances/VersionSelectionModal.tsx'
import { ConfigModules } from 'types/enums.ts'
import { toast } from 'react-toastify'

import { useManageInstances } from '../../../components/InstanceManager.tsx'
import { updateInstanceHealth } from '../../../store/slices/instancesSlice.ts'
import { IInstanceHealth } from 'types/schemas/Instances.ts'
import { IDeploymentGroup } from 'types/schemas/Applications.ts'

export interface IViewProps {
  instance?: IInstance
  instanceTabs: TabsProps['items']
  instanceMenuItems: instanceMenuItem
  toggleInstanceEdit: (open: boolean) => void
  instanceMenuContainer: IMenuContainerRef
  instanceHealthObj: IInstanceHealth
  deploymentGroup?: IDeploymentGroup
}

type instanceMenuItem = {
  text: string | React.ReactNode
  onClick: () => void
  icon?: string
}[][]

const instanceStatusMap: {
  running: InstanceServiceStatus[]
  failed: InstanceServiceStatus[]
  stopped: InstanceServiceStatus[]
  preConfig: InstanceServiceStatus[]
} = {
  running: [InstanceServiceStatus.RUNNING],
  failed: [InstanceServiceStatus.CREATION_FAILED, InstanceServiceStatus.FAILED],
  stopped: [InstanceServiceStatus.STOPPED],
  preConfig: [InstanceServiceStatus.PRE_CONFIGURED],
}

const ViewInstanceContainer = ({ setId }: IApplicationProps) => {
  const [instance, setInstance] = useState<IInstance>()
  const [instanceMenuItems, setInstanceMenuItems] = useState<instanceMenuItem>([])
  const [showEditInstance, setShowEditInstance] = useState(false)
  const [showVersionSelectionModal, setShowVersionSelectionModal] = useState(false)
  const [saving, setSaving] = useState(false)

  const { selectedApplication } = useSelector((state: IStore) => state.applications)
  const instanceHealths = useSelector((state: IStore) => state.instances?.instanceHealths)
  const instanceHealthObj = instanceHealths[instance?._id?.toString() || '']

  const { id, instanceId } = useParams()
  const setBreadcrumbs = useSetBreadcrumbs()
  const navigate = useNavigate()
  const instanceMenuContainer = useMenuContainer()
  const dispatch = useDispatch()

  const { addDeployment } = useManageInstances()

  const deploymentGroup = Object.values(selectedApplication?.config?.deployment_groups || {})?.find(
    ({ _id }) => _id.toString() === instance?.deployment_group?.toString(),
  )

  useEffect(() => {
    setId(id)
  }, [id])

  useEffect(() => {
    if (!id || !instanceId) return
    setBreadcrumbs(
      breadcrumbs.VIEW_APPLICATION_INSTANCE(
        selectedApplication?.application_name || id,
        id,
        instanceId,
        instance?.name || instanceId,
      ),
    )
  }, [selectedApplication, instance])

  useEffect(() => {
    getInstance()
  }, [instanceId])

  useEffect(() => {
    if (!instance) return
    const instanceMenuItems: instanceMenuItem = [
      [
        {
          text: 'Configure',
          onClick: () => {
            instanceMenuContainer?.closeMenu?.()
            toggleInstanceEdit(true)
          },
        },
      ],
      [
        {
          text: (
            <Popconfirm
              onConfirm={deleteInstance}
              title={`Are you sure that you want to delete, ${instance.name}?`}
            >{`Delete Instance`}</Popconfirm>
          ),
          onClick: () => {},
        },
      ],
    ]

    // if (!instance?.tenant) {
    //   instanceMenuItems.unshift([{ text: 'Allocate Tenant', onClick: () => {} }])
    // }

    if (instanceStatusMap.running.includes(instance.service_status)) {
      const runningItems: instanceMenuItem = [
        [
          {
            text: 'Stop Instance',
            onClick: () => {},
          },
        ],
      ]
      instanceMenuItems.unshift(...runningItems)
    } else if (instanceStatusMap.failed.includes(instance.service_status)) {
      const items: instanceMenuItem = [
        [
          {
            text: 'Re-Initialize Instance',
            onClick: () => {},
          },
        ],
      ]
      instanceMenuItems.unshift(...items)
    } else if (instanceStatusMap.stopped.includes(instance.service_status)) {
      const items: instanceMenuItem = [
        [
          {
            text: 'Start Instance',
            onClick: () => {},
          },
        ],
      ]
      instanceMenuItems.unshift(...items)
    } else if (instanceStatusMap.preConfig.includes(instance.service_status)) {
      const items: instanceMenuItem = [
        [
          {
            text: 'Deploy Instance',
            onClick: deployInstance,
          },
          {
            text: 'Select Version',
            onClick: () => {
              toggleVersionSelectionModal(true)
            },
          },
        ],
      ]
      instanceMenuItems.unshift(...items)
    }

    setInstanceMenuItems(
      instanceStatusMap.preConfig.includes(instance.service_status)
        ? instanceMenuItems
        : [
            ...instanceMenuItems,
            [
              {
                text: 'Redeploy Instance',
                onClick: deployInstance,
              },
              {
                text: 'Select Version',
                onClick: () => {
                  toggleVersionSelectionModal(true)
                },
              },
            ],
          ],
    )
  }, [instance])

  const deployInstance = async () => {
    if (!id || !instanceId || !instance) return
    const result = (await addDeployment(instance)) as { instance: IInstance } | undefined
    result?.instance && setInstance(result?.instance)
  }

  const getInstance = async () => {
    if (!id || !instanceId) return
    const {
      data: { data, success },
    } = await apiAxios.get(`/applications/${id}/instances/${instanceId}`)
    if (success) {
      setInstance(data?.instance)
      const instanceHealthPayload: IInstanceHealth = {
        instance_id: instanceId,
        health: data?.instance?.service_health,
        healthLastUpdated: data?.instance?.service_health_updated_at,
        instanceServiceStatus: data?.instance?.service_status,
        replica_health: data?.instance?.replica_health,
      }
      dispatch(updateInstanceHealth(instanceHealthPayload))
    }
  }

  const deleteInstance = async () => {
    if (!id || !instanceId) return
    const {
      data: { success },
    } = await apiAxios.delete(`/applications/${id}/instances/${instanceId}`)
    if (success) {
      navigate(`/applications/${id}/instances/`)
    }
  }

  // const getVersion = async (id: string) => {
  //   if (!id) return
  //   const {
  //     data: { data, success },
  //   } = await apiAxios.get(`/applications/${id}/versions/${id}`)
  //   if (success) {
  //     setVersionData(data?.version)
  //   }
  // }

  const toggleInstanceEdit = (open: boolean) => {
    setShowEditInstance(open)
  }

  const toggleVersionSelectionModal = (open: boolean) => {
    setShowVersionSelectionModal(open)
  }

  const instanceTabs = [
    {
      key: 'overview',
      label: 'Overview',
      children: selectedApplication && (
        <InstanceOverview
          application={selectedApplication}
          instance={instance}
          setInstance={setInstance}
          toggleInstanceEdit={toggleInstanceEdit}
        />
      ),
    },
    {
      key: 'config',
      label: 'Environment Config',
      children: selectedApplication && <EnvironmentConfig application={selectedApplication} instance={instance} />,
    },
    {
      key: 'secrets',
      label: 'Secrets',
      children: selectedApplication && <SecretsConfig application={selectedApplication} instance={instance} />,
    },
    {
      key: 'logs',
      label: 'Logs',
    },
  ]

  const onInstanceSave = async (values: any) => {
    setSaving(true)
    const toastId = toast('Updating instance...', { isLoading: true })
    const { data } = await apiAxiosToast(toastId).put(`/applications/${id}/instances/${instanceId}`, values)
    if (data.success) {
      setInstance(data?.data?.instance?.instance)
      toggleInstanceEdit(false)
      toast.update(toastId, { isLoading: false, type: 'success', render: 'Instance updated successfully' })
    }
    setSaving(false)
  }

  const onVersionUpdate = async (data: any) => {
    setSaving(true)

    const toastId = toast('Updating version...', { isLoading: true })

    const payload = {
      configModule: ConfigModules.INSTANCE_VERSION,
      version_id: data.version_id,
      updateService: false,
    }
    const { data: responseData } = await apiAxiosToast(toastId).put(
      `/applications/${id}/instances/${instanceId}/config`,
      payload,
    )

    if (responseData.success) {
      setInstance(responseData?.data?.instance?.instance)
      toggleVersionSelectionModal(false)
      toast.update(toastId, { isLoading: false, type: 'success', render: 'Version updated successfully' })
    }

    setSaving(false)
  }

  return (
    <>
      <ViewInstance
        toggleInstanceEdit={toggleInstanceEdit}
        instance={instance}
        instanceTabs={instanceTabs}
        instanceMenuItems={instanceMenuItems}
        instanceMenuContainer={instanceMenuContainer}
        instanceHealthObj={instanceHealthObj}
        deploymentGroup={deploymentGroup}
      />
      <SideFullMenu
        onClose={() => {
          toggleInstanceEdit(false)
        }}
        title={'Edit Instance'}
        visible={showEditInstance}
      >
        <EditInstanceMenu
          saving={saving}
          instance={instance}
          onClose={() => {
            toggleInstanceEdit(false)
          }}
          onSave={onInstanceSave}
          selectedApplication={selectedApplication}
        />
      </SideFullMenu>

      <VersionSelectionModal
        selectedApplication={selectedApplication}
        instance={instance}
        open={showVersionSelectionModal}
        onCancel={() => {
          toggleVersionSelectionModal(false)
        }}
        onVersionUpdate={onVersionUpdate}
        saving={saving}
      />
    </>
  )
}

interface IInstanceMenuProps {
  instanceMenuItems: instanceMenuItem
}

export const InstanceMenu = (props: IInstanceMenuProps) => {
  const { instanceMenuItems } = props
  return (
    <div>
      {instanceMenuItems?.map((items, index) => (
        <ul key={index}>
          {items?.map((item, itemIndex) => {
            return (
              <li key={itemIndex}>
                <Link
                  to={'#'}
                  onClick={(e) => {
                    if (item?.onClick) {
                      e.preventDefault()
                      e.stopPropagation()
                      item?.onClick()
                    }
                  }}
                >
                  {item?.icon && <Icon icon={item?.icon} />}
                  <span>{item.text}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      ))}
    </div>
  )
}

export default ViewInstanceContainer
