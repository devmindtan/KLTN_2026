import {
  LogOutIcon,
  MoreVerticalIcon,
  UserCircleIcon,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import { IconLock, IconActivity } from "@tabler/icons-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useSidebar } from "@/components/layout/custom-sidebar"
import { useAuth } from "@/contexts/AuthContext"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/**
 * Thanh người dùng dưới sidebar – hiển thị động theo role (viewer / technician)
 */
export function NavUser() {
  const { isMobile, open } = useSidebar()
  const { isAuthenticated, user, role, routePrefix, logout } = useAuth()
  const navigate = useNavigate()

  const displayName  = isAuthenticated && user ? user.full_name : "Khách"
  const displayEmail = isAuthenticated && user ? user.email    : "khách - chỉ xem"
  const initials     = displayName.split(" ").slice(-1)[0]?.slice(0, 2).toUpperCase() ?? "KH"

  return (
    <div className="flex flex-col gap-1 w-full">
      <div>
        <Tooltip>
          <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <TooltipTrigger asChild>
            <button
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm font-medium transition-colors",
                "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                "data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground",
                "outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                !open && "justify-center px-0"
              )}
            >
              <Avatar className="h-8 w-8 rounded-lg grayscale shrink-0">
                <AvatarImage src={isAuthenticated ? "/avatars/technician.jpg" : ""} alt={displayName} />
                <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
              </Avatar>
              {open && (
                <>
                  <div className="grid flex-1 min-w-0 overflow-hidden text-left text-sm leading-tight">
                    <span className="truncate font-medium">{displayName}</span>
                    <span className="truncate text-xs text-muted-foreground">{displayEmail}</span>
                  </div>
                  <MoreVerticalIcon className="ml-auto size-4 shrink-0" />
                </>
              )}
            </button>
            </TooltipTrigger>
          </DropdownMenuTrigger>
          {!open && <TooltipContent side="right" align="center">{displayName}</TooltipContent>}

          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 min-w-0 overflow-hidden text-left text-sm leading-tight">
                  <span className="truncate font-medium">{displayName}</span>
                  <span className="truncate text-xs text-muted-foreground">{displayEmail}</span>
                </div>
                <Badge variant={role === "technician" ? "default" : "secondary"} className="text-[10px] px-1.5">
                  {role === "technician" ? "KTV" : "Khách"}
                </Badge>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            {isAuthenticated ? (
              /* Technician menu */
              <>
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => navigate(`/${routePrefix}/settings`)}>
                    <UserCircleIcon className="mr-2 size-4" />
                    Tài khoản
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate(`/${routePrefix}/settings`)}>
                    <IconActivity size={16} className="mr-2" />
                    Lịch sử hoạt động
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => logout().then(() => navigate("/login"))}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOutIcon className="mr-2 size-4" />
                  Đăng xuất
                </DropdownMenuItem>
              </>
            ) : (
              /* Viewer menu */
              <>
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => navigate(`/${routePrefix}/settings`)}>
                    <UserCircleIcon className="mr-2 size-4" />
                    Cài đặt
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/login")}>
                  <IconLock size={16} className="mr-2" />
                  Đăng nhập kỹ thuật viên
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
          </DropdownMenu>
        </Tooltip>
      </div>
    </div>
  )
}
