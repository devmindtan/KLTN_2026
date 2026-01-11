"use client"

import {useLocation, Link} from "react-router-dom"
import {Separator} from "@/components/ui/separator"
import {SidebarTrigger} from "@/components/ui/sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import React from "react"

export function SiteHeader() {
  const {pathname} = useLocation()

  // Tách path: "/user/dashboard" -> ["user", "dashboard"]
  const pathSegments = pathname.split("/").filter(Boolean)

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear">
      <div className="flex w-full items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1"/>
        <Separator orientation="vertical" className="mx-2 h-4"/>

        <Breadcrumb>
          <BreadcrumbList>
            {pathSegments.map((segment, index) => {
              let href = `/${pathSegments.slice(0, index + 1).join("/")}`
              if (segment.toLowerCase() === "user") {
                href = "/user/dashboard"
              }
              const isLast = index === pathSegments.length - 1
              const title = segment
                .split("-")
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(" ")
              return (
                <React.Fragment key={href}>
                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage className="font-[550]">{title}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link to={href}>{title}</Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {!isLast && <BreadcrumbSeparator/>}
                </React.Fragment>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </header>
  )
}