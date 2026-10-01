import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { avatarHueForPlayer, playerInitial } from "@/lib/players"

export function PlayerAvatar({ id, name, size = "default" }: { id: string; name: string; size?: "default" | "sm" | "lg" }) {
  const hue = avatarHueForPlayer(id)
  return (
    <Avatar size={size}>
      <AvatarFallback style={{ backgroundColor: `hsl(${hue} 70% 85%)`, color: `hsl(${hue} 70% 25%)` }}>
        {playerInitial(name)}
      </AvatarFallback>
    </Avatar>
  )
}
