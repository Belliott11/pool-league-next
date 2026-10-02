import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { avatarHueForPlayer, playerInitial, playerPhotoUrl } from "@/lib/players"

// The player's photo when there is one, otherwise their initial on a color derived from their id.
export function PlayerAvatar({ id, name, size = "default" }: { id: string; name: string; size?: "default" | "sm" | "lg" }) {
  const hue = avatarHueForPlayer(id)
  const photo = playerPhotoUrl(id)
  return (
    <Avatar size={size}>
      {photo && <AvatarImage src={photo} alt="" />}
      <AvatarFallback style={{ backgroundColor: `hsl(${hue} 70% 85%)`, color: `hsl(${hue} 70% 25%)` }}>
        {playerInitial(name)}
      </AvatarFallback>
    </Avatar>
  )
}
