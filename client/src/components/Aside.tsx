import { Avatar } from "antd"
import MenuContainer from "./MenuContainer"
import UserMenu from "./userMenu/UserMenu"
import { useSelector } from "react-redux"
import { IStore } from "../store/store"
import { useState } from "react"
import permissions from "../helpers/constants/permissions"
import { Link } from "react-router-dom"
import Icon, { IconStyles } from "./Icon"

interface IMenuItem {
  name: string
  icon: string
  path: string
  permissions: string[]
  iconStyle?: IconStyles
}

interface ISubMenuItem extends IMenuItem {
  subMenu: IMenuItem[]
}

const asideMenuItems: (IMenuItem | ISubMenuItem)[] = [
  {
    name: "Dashboard",
    icon: "DASHBOARD",
    path: "/",
    permissions: [permissions.STANDARD_ACCESS],
  },
  {
    name: "Applications",
    icon: "APPLICATION",
    path: "/applications",
    permissions: [permissions.APPLICATIONS.VIEW_APPLICATIONS],
    subMenu: [
      {
        name: "Overview",
        icon: "APPLICATION",
        path: "/",
        // Path will be include selectedApplicationId in the URL
        // Users can quick switch between applications by selecting the application from dropdown in breadcrumbs
        permissions: [permissions.APPLICATIONS.VIEW_APPLICATIONS],
      },
      {
        name: "Plans",
        icon: "APPLICATION",
        path: "/plans",
        permissions: [permissions.APPLICATIONS.VIEW_APPLICATIONS],
      },
      {
        name: "Versions",
        icon: "APPLICATION",
        path: "/versions",
        permissions: [permissions.APPLICATIONS.VIEW_APPLICATIONS],
      },
      {
        name: "Instances",
        icon: "APPLICATION",
        path: "/instances",
        permissions: [permissions.APPLICATIONS.VIEW_APPLICATIONS],
      },
      {
        name: "Configuration",
        icon: "APPLICATION",
        path: "/configuration",
        permissions: [permissions.APPLICATIONS.VIEW_APPLICATIONS],
      },
    ],
  },
  {
    name: "Servers",
    icon: "SERVER",
    path: "/servers",
    permissions: [permissions.STANDARD_ACCESS],
  },
  {
    name: "Domains",
    icon: "DOMAIN",
    path: "/domains",
    permissions: [permissions.STANDARD_ACCESS],
  },
  {
    name: "Contacts",
    icon: "CONTACT",
    path: "/contacts",
    permissions: [permissions.STANDARD_ACCESS],
  },
  {
    name: "Tenants",
    icon: "TENANT",
    path: "/tenants",
    permissions: [permissions.TENANTS.VIEW_TENANTS],
  },
  {
    name: "Databases",
    icon: "DATABASE",
    path: "/databases",
    permissions: [permissions.STANDARD_ACCESS],
  },
  {
    name: "Settings",
    icon: "SETTINGS",
    path: "/settings",
    permissions: [permissions.SUPER_ACCESS],
  },
]
const Aside = () => {
  const user = useSelector((state: IStore) => state.user)
  const configData = useSelector((state: IStore) => state.configData)
  const breadcrumbs = useSelector((state: IStore) => state.breadcrumbs)

  const { menuOpen: asideOpen } = configData

  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const userMenuChange = (value: boolean) => {
    setUserMenuOpen(value)
  }

  const checkIfActive = (path: string) => {
    return breadcrumbs?.[0]?.path === path
  }

  const checkIfHasPerms = (permissionArray: string[]) => {
    const userPermissions = user?.permissions
    if (!userPermissions) return

    if (userPermissions.includes(permissions.SUPER_ACCESS)) return true

    for (const permission of permissionArray) {
      if (userPermissions.includes(permission)) return true
    }
  }

  const generateMenuItem = (item: ISubMenuItem | IMenuItem, i: number) => {
    const isParent = "subMenu" in item && !!item?.subMenu?.length

    return isParent ? (
      <li
        key={i}
        className={` p-relative ${checkIfActive(item.path) ? "active" : ""}`}
      >
        <div className='d-flex align-center'>
          <Link to={item.path}>
            <span className='icon'>
              <Icon icon={item.icon} style={item?.iconStyle || "solid"} />
            </span>
            <div className='title'>{item.name}</div>
          </Link>
        </div>
        <ul>
          {item?.subMenu?.map((subItem, subItemIndex) =>
            generateMenuItem(subItem, subItemIndex)
          )}
        </ul>
      </li>
    ) : (
      <li
        key={i}
        className={`d-flex align-center p-relative ${
          checkIfActive(item.path) ? "active" : ""
        }`}
      >
        <Link to={item.path}>
          <span className='icon'>
            <Icon icon={item.icon} style={item?.iconStyle || "solid"} />
          </span>
          <div className='title'>{item.name}</div>
        </Link>
      </li>
    )
  }

  return (
    <aside className={`aside ${asideOpen ? "" : "hidden"}`}>
      <h1>SaaScape</h1>
      <div className={`user ${userMenuOpen ? "open" : ""}`}>
        <MenuContainer MenuComponent={<UserMenu />} onChange={userMenuChange}>
          <div className='user-menu d-flex justify-start'>
            <div className='user-image'>
              <Avatar shape='square' size={"large"}>
                {user?.first_name?.charAt(0).toUpperCase()}
                {user?.last_name?.charAt(0).toUpperCase()}
              </Avatar>
            </div>
            <div className='user-data'>
              <div className='user-name p-relative'>
                {user?.first_name} {user?.last_name}
              </div>
            </div>
          </div>
        </MenuContainer>
      </div>
      <nav>
        <ul>
          {asideMenuItems.map((item, i) => {
            if (!checkIfHasPerms(item.permissions)) return null
            return generateMenuItem(item, i)
          })}
        </ul>
      </nav>
    </aside>
  )
}

export default Aside
