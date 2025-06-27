import path from "path"
import { readdir } from "fs/promises"

export namespace Project {
  export async function getName(rootPath: string): Promise<string> {
    try {
      const packageJsonPath = path.join(rootPath, "package.json")
      const packageJson = await Bun.file(packageJsonPath).json()
      if (packageJson.name && typeof packageJson.name === "string") {
        return packageJson.name
      }
    } catch {}

    try {
      const cargoTomlPath = path.join(rootPath, "Cargo.toml")
      const cargoToml = await Bun.file(cargoTomlPath).text()
      const nameMatch = cargoToml.match(/^\s*name\s*=\s*"([^"]+)"/m)
      if (nameMatch?.[1]) {
        return nameMatch[1]
      }
    } catch {}

    try {
      const pyprojectPath = path.join(rootPath, "pyproject.toml")
      const pyproject = await Bun.file(pyprojectPath).text()
      const nameMatch = pyproject.match(/^\s*name\s*=\s*"([^"]+)"/m)
      if (nameMatch?.[1]) {
        return nameMatch[1]
      }
    } catch {}

    try {
      const goModPath = path.join(rootPath, "go.mod")
      const goMod = await Bun.file(goModPath).text()
      const moduleMatch = goMod.match(/^module\s+(.+)$/m)
      if (moduleMatch?.[1]) {
        // Extract just the last part of the module path
        const parts = moduleMatch[1].trim().split("/")
        return parts[parts.length - 1]
      }
    } catch {}

    try {
      const composerPath = path.join(rootPath, "composer.json")
      const composer = await Bun.file(composerPath).json()
      if (composer.name && typeof composer.name === "string") {
        // Composer names are usually vendor/package, extract the package part
        const parts = composer.name.split("/")
        return parts[parts.length - 1]
      }
    } catch {}

    try {
      const pomPath = path.join(rootPath, "pom.xml")
      const pom = await Bun.file(pomPath).text()
      const artifactIdMatch = pom.match(/<artifactId>([^<]+)<\/artifactId>/)
      if (artifactIdMatch?.[1]) {
        return artifactIdMatch[1]
      }
    } catch {}

    for (const gradleFile of ["build.gradle", "build.gradle.kts"]) {
      try {
        const gradlePath = path.join(rootPath, gradleFile)
        await Bun.file(gradlePath).text() // Check if gradle file exists
        // Look for rootProject.name in settings.gradle
        const settingsPath = path.join(rootPath, "settings.gradle")
        const settings = await Bun.file(settingsPath).text()
        const nameMatch = settings.match(
          /rootProject\.name\s*=\s*['"]([^'"]+)['"]/,
        )
        if (nameMatch?.[1]) {
          return nameMatch[1]
        }
      } catch {}
    }

    const dotnetExtensions = [".csproj", ".fsproj", ".vbproj"]
    try {
      const files = await readdir(rootPath)
      for (const file of files) {
        if (dotnetExtensions.some((ext) => file.endsWith(ext))) {
          // Use the filename without extension as project name
          return path.basename(file, path.extname(file))
        }
      }
    } catch {}

    return path.basename(rootPath)
  }
}
