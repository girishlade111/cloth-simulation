"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Switch } from "@/components/ui/switch"
import { RotateCcw, Play, Pause } from "lucide-react"
import { MeshGradient } from "@paper-design/shaders-react"

interface Point {
  x: number
  y: number
  oldX: number
  oldY: number
  pinned: boolean
}

interface Constraint {
  p1: Point
  p2: Point
  restLength: number
}

class ClothSimulation {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private points: Point[] = []
  private constraints: Constraint[] = []
  private width: number
  private height: number
  private clothWidth = 45 // Increased from 35 to 45 for more detail
  private clothHeight = 18 // Increased from 15 to 20 for more detail
  private spacing = 18
  private gravity = 0.7
  private friction = 0.99
  private damping = 0.02
  private constraintRelaxation = 0.5
  private windStrength = 0.75
  private windDirection = 1
  private windVariation = 1
  private mouse = { x: 0, y: 0, down: false, radius: 80 } // Increased mouse interaction radius from 50 to 80 for larger interactive area
  private draggedPoint: Point | null = null
  private dragOffset = { x: 0, y: 0 }
  private animationId = 0
  private tearMode = false
  private tearRadius = 18
  private showConstraints = true
  private showPoints = true
  private constraintOpacity = 1.0
  private pointOpacity = 0.8

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext("2d")!
    this.width = canvas.width
    this.height = canvas.height

    this.setupEventListeners()
    this.createCloth()
  }

  private setupEventListeners() {
    const getMousePos = (e: MouseEvent) => {
      const rect = this.canvas.getBoundingClientRect()
      const scaleX = this.canvas.width / rect.width
      const scaleY = this.canvas.height / rect.height
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      }
    }

    this.canvas.addEventListener("mousedown", (e) => {
      const pos = getMousePos(e)
      this.mouse.x = pos.x
      this.mouse.y = pos.y
      this.mouse.down = true

      if (this.tearMode) {
        this.tearCloth(pos.x, pos.y)
      } else {
        this.draggedPoint = this.findNearestPoint(pos.x, pos.y, 20)
        if (this.draggedPoint) {
          this.dragOffset.x = pos.x - this.draggedPoint.x
          this.dragOffset.y = pos.y - this.draggedPoint.y
        }
      }
    })

    this.canvas.addEventListener("mousemove", (e) => {
      const pos = getMousePos(e)
      this.mouse.x = pos.x
      this.mouse.y = pos.y

      if (this.tearMode && this.mouse.down) {
        this.tearCloth(pos.x, pos.y)
      } else if (this.draggedPoint && this.mouse.down && !this.draggedPoint.pinned) {
        this.draggedPoint.x = pos.x - this.dragOffset.x
        this.draggedPoint.y = pos.y - this.dragOffset.y
        this.draggedPoint.oldX = this.draggedPoint.x
        this.draggedPoint.oldY = this.draggedPoint.y
      }
    })

    this.canvas.addEventListener("mouseup", () => {
      this.mouse.down = false
      this.draggedPoint = null
    })

    this.canvas.addEventListener("mouseleave", () => {
      this.mouse.down = false
      this.draggedPoint = null
    })
  }

  private findNearestPoint(mouseX: number, mouseY: number, maxDistance: number): Point | null {
    let nearestPoint: Point | null = null
    let nearestDistance = maxDistance

    for (const point of this.points) {
      const dx = point.x - mouseX
      const dy = point.y - mouseY
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestPoint = point
      }
    }

    return nearestPoint
  }

  private createCloth() {
    this.points = []
    this.constraints = []

    const startX = (this.width - (this.clothWidth - 1) * this.spacing) / 2 // Center the cloth horizontally
    const startY = 50

    for (let y = 0; y < this.clothHeight; y++) {
      for (let x = 0; x < this.clothWidth; x++) {
        const point: Point = {
          x: startX + x * this.spacing,
          y: startY + y * this.spacing,
          oldX: startX + x * this.spacing,
          oldY: startY + y * this.spacing,
          pinned: y === 0,
        }
        this.points.push(point)
      }
    }

    for (let y = 0; y < this.clothHeight; y++) {
      for (let x = 0; x < this.clothWidth; x++) {
        const index = y * this.clothWidth + x

        if (x < this.clothWidth - 1) {
          const p1 = this.points[index]
          const p2 = this.points[index + 1]
          this.constraints.push({
            p1,
            p2,
            restLength: this.spacing,
          })
        }

        if (y < this.clothHeight - 1) {
          const p1 = this.points[index]
          const p2 = this.points[index + this.clothWidth]
          this.constraints.push({
            p1,
            p2,
            restLength: this.spacing,
          })
        }

        if (x < this.clothWidth - 1 && y < this.clothHeight - 1) {
          const p1 = this.points[index]
          const p2 = this.points[index + this.clothWidth + 1]
          this.constraints.push({
            p1,
            p2,
            restLength: this.spacing * Math.sqrt(2),
          })

          const p3 = this.points[index + 1]
          const p4 = this.points[index + this.clothWidth]
          this.constraints.push({
            p1: p3,
            p2: p4,
            restLength: this.spacing * Math.sqrt(2),
          })
        }
      }
    }
  }

  private updatePoints() {
    this.windVariation = Math.sin(Date.now() * 0.002) * 0.3 + Math.sin(Date.now() * 0.005) * 0.2

    for (const point of this.points) {
      if (point.pinned) continue

      if (point === this.draggedPoint) continue

      const velX = (point.x - point.oldX) * this.friction
      const velY = (point.y - point.oldY) * this.friction

      const dampedVelX = velX * (1 - this.damping)
      const dampedVelY = velY * (1 - this.damping)

      point.oldX = point.x
      point.oldY = point.y

      point.x += dampedVelX
      point.y += dampedVelY + this.gravity

      const currentWindForce = this.windStrength * (1 + this.windVariation) * this.windDirection
      point.x += currentWindForce

      if (this.mouse.down && !this.draggedPoint) {
        const dx = point.x - this.mouse.x
        const dy = point.y - this.mouse.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (distance < this.mouse.radius) {
          const force = (this.mouse.radius - distance) / this.mouse.radius
          point.x += dx * force * 0.1
          point.y += dy * force * 0.1
        }
      }

      if (point.x < 0) {
        point.x = 0
        point.oldX = point.x + (point.x - point.oldX) * 0.8
      }
      if (point.x > this.width) {
        point.x = this.width
        point.oldX = point.x + (point.x - point.oldX) * 0.8
      }
      if (point.y < 0) {
        point.y = 0
        point.oldY = point.y + (point.y - point.oldY) * 0.8
      }
      if (point.y > this.height) {
        point.y = this.height
        point.oldY = point.y + (point.y - point.oldY) * 0.8
      }
    }
  }

  private satisfyConstraints() {
    for (let iteration = 0; iteration < 4; iteration++) {
      const relaxationFactor = this.constraintRelaxation * (1 - iteration * 0.1)

      for (const constraint of this.constraints) {
        const { p1, p2, restLength } = constraint

        const dx = p2.x - p1.x
        const dy = p2.y - p1.y
        const distanceSquared = dx * dx + dy * dy
        const distance = Math.sqrt(distanceSquared)

        if (distance === 0) continue

        const difference = restLength - distance
        const percent = (difference / distance / 2) * relaxationFactor
        const offsetX = dx * percent
        const offsetY = dy * percent

        if (!p1.pinned) {
          p1.x -= offsetX
          p1.y -= offsetY
        }
        if (!p2.pinned) {
          p2.x += offsetX
          p2.y += offsetY
        }
      }

      if (iteration % 2 === 0) {
        this.preventSelfCollisionOptimized()
      }
    }
  }

  private preventSelfCollisionOptimized() {
    const minDistance = this.spacing * 0.5
    const minDistanceSquared = minDistance * minDistance
    const gridSize = this.spacing * 1.5
    const gridWidth = Math.ceil(this.width / gridSize)
    const gridHeight = Math.ceil(this.height / gridSize)
    const grid: Point[][] = []

    for (let i = 0; i < gridWidth * gridHeight; i++) {
      grid[i] = []
    }

    for (const point of this.points) {
      const gridX = Math.max(0, Math.min(gridWidth - 1, Math.floor(point.x / gridSize)))
      const gridY = Math.max(0, Math.min(gridHeight - 1, Math.floor(point.y / gridSize)))
      const gridIndex = gridY * gridWidth + gridX

      if (gridIndex >= 0 && gridIndex < grid.length) {
        grid[gridIndex].push(point)
      }
    }

    for (let gridY = 0; gridY < gridHeight; gridY++) {
      for (let gridX = 0; gridX < gridWidth; gridX++) {
        const gridIndex = gridY * gridWidth + gridX
        const cellPoints = grid[gridIndex]

        if (!cellPoints || cellPoints.length === 0) continue

        for (let i = 0; i < cellPoints.length; i++) {
          for (let j = i + 1; j < cellPoints.length; j++) {
            this.checkPointCollision(cellPoints[i], cellPoints[j], minDistanceSquared)
          }
        }

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue

            const neighborX = gridX + dx
            const neighborY = gridY + dy

            if (neighborX >= 0 && neighborX < gridWidth && neighborY >= 0 && neighborY < gridHeight) {
              const neighborIndex = neighborY * gridWidth + neighborX
              const neighborPoints = grid[neighborIndex]

              if (neighborPoints && neighborPoints.length > 0) {
                for (const p1 of cellPoints) {
                  for (const p2 of neighborPoints) {
                    this.checkPointCollision(p1, p2, minDistanceSquared)
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  private checkPointCollision(p1: Point, p2: Point, minDistanceSquared: number) {
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    const distanceSquared = dx * dx + dy * dy

    if (distanceSquared < minDistanceSquared && distanceSquared > 0.01) {
      const isDirectlyConnected = this.constraints.some(
        (c) => (c.p1 === p1 && c.p2 === p2) || (c.p1 === p2 && c.p2 === p1),
      )
      if (isDirectlyConnected) return

      const distance = Math.sqrt(distanceSquared)
      const minDistance = Math.sqrt(minDistanceSquared)
      const overlap = minDistance - distance
      const pushDistance = overlap * 0.6
      const pushX = (dx / distance) * pushDistance
      const pushY = (dy / distance) * pushDistance

      if (!p1.pinned) {
        p1.x -= pushX
        p1.y -= pushY
      }
      if (!p2.pinned) {
        p2.x += pushX
        p2.y += pushY
      }
    }
  }

  private tearCloth(mouseX: number, mouseY: number) {
    this.constraints = this.constraints.filter((constraint) => {
      const { p1, p2 } = constraint

      const midX = (p1.x + p2.x) / 2
      const midY = (p1.y + p2.y) / 2
      const dx = midX - mouseX
      const dy = midY - mouseY
      const distance = Math.sqrt(dx * dx + dy * dy)

      return distance > this.tearRadius
    })
  }

  private render() {
    this.ctx.clearRect(0, 0, this.width, this.height)

    if (this.showConstraints) {
      this.ctx.strokeStyle = `rgba(255, 255, 255, ${this.constraintOpacity * 0.6})`
      this.ctx.lineWidth = 1
      this.ctx.beginPath()

      for (const constraint of this.constraints) {
        this.ctx.moveTo(constraint.p1.x, constraint.p1.y)
        this.ctx.lineTo(constraint.p2.x, constraint.p2.y)
      }
      this.ctx.stroke()
    }

    if (this.showPoints) {
      for (const point of this.points) {
        if (point === this.draggedPoint) {
          this.ctx.fillStyle = `rgba(255, 255, 255, ${this.pointOpacity})`
        } else if (point.pinned) {
          this.ctx.fillStyle = `rgba(255, 255, 255, ${this.pointOpacity * 0.9})`
        } else {
          this.ctx.fillStyle = `rgba(200, 200, 200, ${this.pointOpacity * 0.7})`
        }

        this.ctx.beginPath()
        this.ctx.arc(point.x, point.y, point.pinned || point === this.draggedPoint ? 4 : 2, 0, Math.PI * 2)
        this.ctx.fill()
      }
    }

    if (this.tearMode && this.mouse.down) {
      this.ctx.strokeStyle = "rgba(255, 255, 255, 0.5)"
      this.ctx.lineWidth = 2
      this.ctx.beginPath()
      this.ctx.arc(this.mouse.x, this.mouse.y, this.tearRadius, 0, Math.PI * 2)
      this.ctx.stroke()
    } else if (this.mouse.down && !this.draggedPoint && !this.tearMode) {
      this.ctx.strokeStyle = "rgba(255, 255, 255, 0.3)"
      this.ctx.lineWidth = 2
      this.ctx.beginPath()
      this.ctx.arc(this.mouse.x, this.mouse.y, this.mouse.radius, 0, Math.PI * 2)
      this.ctx.stroke()
    }
  }

  public update() {
    this.updatePoints()
    this.satisfyConstraints()
    this.render()
  }

  public start() {
    const animate = () => {
      this.update()
      this.animationId = requestAnimationFrame(animate)
    }
    animate()
  }

  public stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
    }
  }

  public setWindStrength(value: number) {
    this.windStrength = value
  }

  public setWindDirection(value: number) {
    this.windDirection = value
  }

  public setGravity(value: number) {
    this.gravity = value
  }

  public setFriction(value: number) {
    this.friction = value
  }

  public setStiffness(value: number) {
    this.constraintRelaxation = value
  }

  public setTearMode(enabled: boolean) {
    this.tearMode = enabled
  }

  public getTearMode(): boolean {
    return this.tearMode
  }

  public reset() {
    this.createCloth()
  }

  public setShowConstraints(show: boolean) {
    this.showConstraints = show
  }

  public setShowPoints(show: boolean) {
    this.showPoints = show
  }

  public setConstraintOpacity(opacity: number) {
    this.constraintOpacity = opacity
  }

  public setPointOpacity(opacity: number) {
    this.pointOpacity = opacity
  }

  public getShowConstraints(): boolean {
    return this.showConstraints
  }

  public getShowPoints(): boolean {
    return this.showPoints
  }
}

export default function ClothPhysicsSimulation() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const simulationRef = useRef<ClothSimulation | null>(null)
  const [isRunning, setIsRunning] = useState(true)
  const [gravity, setGravity] = useState([0.7])
  const [friction, setFriction] = useState([0.99])
  const [stiffness, setStiffness] = useState([0.1]) // Changed initial stiffness from 0.5 to 0.10
  const [windStrength, setWindStrengthState] = useState([0.75])
  const [windDirection, setWindDirectionState] = useState([1])
  const [tearMode, setTearMode] = useState(false)
  const [showConstraints, setShowConstraintsState] = useState(true)
  const [showPoints, setShowPointsState] = useState(true)
  const [constraintOpacity, setConstraintOpacityState] = useState([1.0])
  const [pointOpacity, setPointOpacityState] = useState([1.0])

  useEffect(() => {
    if (canvasRef.current) {
      simulationRef.current = new ClothSimulation(canvasRef.current)
      simulationRef.current.setStiffness(0.1)
      simulationRef.current.start()
    }

    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop()
      }
    }
  }, [])

  const handleToggleSimulation = () => {
    if (isRunning) {
      if (simulationRef.current) {
        simulationRef.current.stop()
        setIsRunning(false)
      }
    } else {
      if (simulationRef.current) {
        simulationRef.current.start()
        setIsRunning(true)
      }
    }
  }

  const handleReset = () => {
    if (simulationRef.current) {
      simulationRef.current.reset()
    }
  }

  const handleGravityChange = (value: number[]) => {
    setGravity(value)
    if (simulationRef.current) {
      simulationRef.current.setGravity(value[0])
    }
  }

  const handleFrictionChange = (value: number[]) => {
    setFriction(value)
    if (simulationRef.current) {
      simulationRef.current.setFriction(value[0])
    }
  }

  const handleStiffnessChange = (value: number[]) => {
    setStiffness(value)
    if (simulationRef.current) {
      simulationRef.current.setStiffness(value[0])
    }
  }

  const handleWindStrengthChange = (value: number[]) => {
    setWindStrengthState(value)
    if (simulationRef.current) {
      simulationRef.current.setWindStrength(value[0])
    }
  }

  const handleWindDirectionChange = (value: number[]) => {
    setWindDirectionState(value)
    if (simulationRef.current) {
      simulationRef.current.setWindDirection(value[0])
    }
  }

  const handleTearModeToggle = () => {
    const newTearMode = !tearMode
    setTearMode(newTearMode)
    if (simulationRef.current) {
      simulationRef.current.setTearMode(newTearMode)
    }
  }

  const handleShowConstraintsToggle = () => {
    const newValue = !showConstraints
    setShowConstraintsState(newValue)
    if (simulationRef.current) {
      simulationRef.current.setShowConstraints(newValue)
    }
  }

  const handleShowPointsToggle = () => {
    const newValue = !showPoints
    setShowPointsState(newValue)
    if (simulationRef.current) {
      simulationRef.current.setShowPoints(newValue)
    }
  }

  const handleConstraintOpacityChange = (value: number[]) => {
    setConstraintOpacityState(value)
    if (simulationRef.current) {
      simulationRef.current.setConstraintOpacity(value[0])
    }
  }

  const handlePointOpacityChange = (value: number[]) => {
    setPointOpacityState(value)
    if (simulationRef.current) {
      simulationRef.current.setPointOpacity(value[0])
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Shader Background */}
      <div className="absolute inset-0 z-0">
        <MeshGradient
          colors={["#000000", "#1a1a1a", "#333333", "#000000"]}
          className="w-full h-full"
          speed={0.01}
        />
      </div>

      {/* Main Content */}
      <div className="relative z-10 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4 font-mono text-gray-300">{"v0 cloth simulation"}</h1>
            
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3">
              <Card className="p-6 bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl px-0.5 py-0.5">
                <canvas
                  ref={canvasRef}
                  width={1000}
                  height={800}
                  className="w-full h-auto bg-black rounded-lg border border-white/30 cursor-crosshair"
                />
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="p-6 bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl px-4 py-0.5">
                <Accordion type="single" defaultValue="controls" className="w-full">
                  <AccordionItem value="controls" className="border-white/20">
                    <AccordionTrigger className="text-white hover:text-gray-200 text-lg font-semibold">
                      Controls
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-4 pb-6">
                      <Button
                        onClick={handleToggleSimulation}
                        className="w-full bg-white text-black hover:bg-gray-200 flex items-center gap-2"
                      >
                        {isRunning ? (
                          <>
                            <Pause className="w-4 h-4" />
                            Pause
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4" />
                            Play
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={handleReset}
                        className="w-full bg-transparent border border-white/30 text-white hover:bg-white/10 backdrop-blur-sm flex items-center gap-2"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Reset Cloth
                      </Button>
                      <div className="flex items-center justify-between">
                        <label className="text-white text-sm font-medium">Tear Mode</label>
                        <Switch checked={tearMode} onCheckedChange={handleTearModeToggle} />
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="visualization" className="border-white/20">
                    <AccordionTrigger className="text-white hover:text-gray-200 text-lg font-semibold">
                      Visualization
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-4 pb-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-200 mb-2">
                          Line Opacity: {constraintOpacity[0].toFixed(2)}
                        </label>
                        <Slider
                          value={constraintOpacity}
                          onValueChange={handleConstraintOpacityChange}
                          max={1}
                          min={0.1}
                          step={0.1}
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-200 mb-2">
                          Point Opacity: {pointOpacity[0].toFixed(2)}
                        </label>
                        <Slider
                          value={pointOpacity}
                          onValueChange={handlePointOpacityChange}
                          max={1}
                          min={0.1}
                          step={0.1}
                          className="w-full"
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="physics" className="border-white/20">
                    <AccordionTrigger className="text-white hover:text-gray-200 text-lg font-semibold">
                      Physics Settings
                    </AccordionTrigger>
                    <AccordionContent className="space-y-6 pt-4 pb-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-200 mb-2">
                          Gravity: {gravity[0].toFixed(2)}
                        </label>
                        <Slider
                          value={gravity}
                          onValueChange={handleGravityChange}
                          max={2}
                          min={0}
                          step={0.1}
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-200 mb-2">
                          Friction: {friction[0].toFixed(3)}
                        </label>
                        <Slider
                          value={friction}
                          onValueChange={handleFrictionChange}
                          max={1}
                          min={0.9}
                          step={0.001}
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-200 mb-2">
                          Stiffness: {stiffness[0].toFixed(2)}
                        </label>
                        <Slider
                          value={stiffness}
                          onValueChange={handleStiffnessChange}
                          max={1}
                          min={0.1}
                          step={0.05}
                          className="w-full"
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="wind" className="border-white/20">
                    <AccordionTrigger className="text-white hover:text-gray-200 text-lg font-semibold">
                      Wind Settings
                    </AccordionTrigger>
                    <AccordionContent className="space-y-6 pt-4 pb-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-200 mb-2">
                          Wind Strength: {windStrength[0].toFixed(2)}
                        </label>
                        <Slider
                          value={windStrength}
                          onValueChange={handleWindStrengthChange}
                          max={0.5}
                          min={0}
                          step={0.01}
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-200 mb-2">
                          Wind Direction: {windDirection[0] > 0 ? "Right" : "Left"}
                        </label>
                        <Slider
                          value={windDirection}
                          onValueChange={handleWindDirectionChange}
                          max={1}
                          min={-1}
                          step={0.1}
                          className="w-full"
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
