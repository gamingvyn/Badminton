import pygame
import sys
import math
import random

# --------------------- Configuration ---------------------
SCREEN_WIDTH = 1100
SCREEN_HEIGHT = 640
FPS = 60

GROUND_Y = SCREEN_HEIGHT - 80
COURT_MARGIN = 80
NET_HEIGHT = 95
NET_WIDTH = 8
COURT_WIDTH = SCREEN_WIDTH - 2 * COURT_MARGIN

PLAYER_WIDTH = 36
PLAYER_HEIGHT = 72
PLAYER_SPEED = 5.2
JUMP_VELOCITY = -12.5
GRAVITY = 0.65

RACKET_W = 10
RACKET_H = 44
RACKET_OFFSET_X = 28
RACKET_OFFSET_Y = 22
SWING_COOLDOWN = 14
SWING_WINDOW = 12

SHUTTLE_RADIUS = 9
SHUTTLE_GRAVITY = 0.55
DRAG_COEFF = 0.0026

WINNING_SCORE = 21

# Colors
COLOR_BG = (28, 102, 65)
COLOR_COURT = (38, 160, 85)
COLOR_LINES = (245, 245, 240)
COLOR_NET = (200, 200, 200)
COLOR_HUMAN = (40, 120, 240)
COLOR_AI = (220, 50, 60)
COLOR_SHUTTLE = (245, 240, 80)
COLOR_TEXT = (255, 255, 255)
COLOR_SERVE = (255, 220, 60)

# Rank system
RANKS = ["Bronze", "Silver", "Gold", "Diamond", "Platinum", "Divine"]
TIERS_PER_RANK = 3

def points_needed_for_tier(rank_index, tier_index):
    return 6 + rank_index * 4 + tier_index * 2

# --------------------- Helper functions ---------------------
def clamp(x, a, b):
    return max(a, min(b, x))

def sign(x):
    return (1, -1)[x < 0]

# --------------------- Classes ---------------------
class Player:
    def __init__(self, x, y, facing_left=False, color=COLOR_HUMAN, is_human=True):
        self.x, self.y = x, y
        self.vx = self.vy = 0
        self.width, self.height = PLAYER_WIDTH, PLAYER_HEIGHT
        self.facing_left = facing_left
        self.color = color
        self.is_human = is_human
        self.on_ground = True
        self.swinging = False
        self.swing_timer = 0
        self.swing_cooldown = 0
        self.prepare_power = 0.0

    def rect(self):
        return pygame.Rect(int(self.x - self.width/2), int(self.y), self.width, self.height)

    def get_racket_rect(self):
        if self.facing_left:
            rx = int(self.x - RACKET_OFFSET_X - RACKET_W)
        else:
            rx = int(self.x + RACKET_OFFSET_X)
        ry = int(self.y + RACKET_OFFSET_Y)
        return pygame.Rect(rx, ry, RACKET_W, RACKET_H)

    def update_physics(self):
        self.x += self.vx
        self.y += self.vy
        if not self.on_ground:
            self.vy += GRAVITY
        if self.y + self.height >= GROUND_Y:
            self.y = GROUND_Y - self.height
            self.vy = 0
            self.on_ground = True
        if self.swing_cooldown > 0:
            self.swing_cooldown -= 1
        if self.swing_timer > 0:
            self.swing_timer -= 1
        else:
            self.swinging = False
            self.prepare_power = 0.0

    def start_swing(self):
        if self.swing_cooldown <= 0:
            self.swinging = True
            self.swing_timer = SWING_WINDOW
            self.swing_cooldown = SWING_COOLDOWN

    def jump(self):
        if self.on_ground:
            self.vy = JUMP_VELOCITY
            self.on_ground = False

class Shuttle:
    def __init__(self, x, y):
        self.x, self.y = x, y
        self.vx = self.vy = 0
        self.r = SHUTTLE_RADIUS
        self.in_play = False
        self.last_hitter = None

    def rect(self):
        return pygame.Rect(int(self.x - self.r), int(self.y - self.r), self.r*2, self.r*2)

    def update(self):
        speed = math.hypot(self.vx, self.vy)
        drag_fx = DRAG_COEFF * self.vx * speed if speed else 0
        drag_fy = DRAG_COEFF * self.vy * speed if speed else 0
        self.vx -= drag_fx
        self.vy -= drag_fy
        self.vy += SHUTTLE_GRAVITY
        self.x += self.vx
        self.y += self.vy

# --------------------- Game ---------------------
class BadmintonGame:
    def __init__(self):
        pygame.init()
        self.screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
        pygame.display.set_caption("Badminton")
        self.clock = pygame.time.Clock()
        mid_x = COURT_MARGIN + COURT_WIDTH/2
        base_y = GROUND_Y - PLAYER_HEIGHT
        self.human = Player(mid_x - 140, base_y, facing_left=False, color=COLOR_HUMAN)
        self.ai = Player(mid_x + 140, base_y, facing_left=True, color=COLOR_AI, is_human=False)
        self.shuttle = Shuttle(self.human.x + 40, self.human.y - 30)
        self.score_human = 0
        self.score_ai = 0
        self.server = 'human'
        self.in_serve_state = True
        self.serve_ready = False
        self.left_down = self.right_down = self.up_down = False
        self.game_over = False

    def handle_events(self):
        for event in pygame.event.get():
            if event.type == pygame.QUIT: sys.exit()
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE: sys.exit()
                if event.key == pygame.K_LEFT: self.left_down = True
                if event.key == pygame.K_RIGHT: self.right_down = True
                if event.key == pygame.K_UP: self.up_down = True
                if event.key == pygame.K_SPACE: self.human.start_swing()
            elif event.type == pygame.KEYUP:
                if event.key == pygame.K_LEFT: self.left_down = False
                if event.key == pygame.K_RIGHT: self.right_down = False
                if event.key == pygame.K_UP: self.up_down = False

    def human_input_update(self):
        self.human.vx = 0
        if self.left_down: self.human.vx = -PLAYER_SPEED
        if self.right_down: self.human.vx = PLAYER_SPEED
        if self.up_down and self.human.on_ground: self.human.jump()

    def update(self):
        self.human_input_update()
        self.human.update_physics()
        self.ai.update_physics()
        if self.shuttle.in_play: self.shuttle.update()

    def draw_court(self):
        self.screen.fill(COLOR_BG)
        pygame.draw.rect(self.screen, COLOR_COURT, pygame.Rect(COURT_MARGIN, GROUND_Y - 340, COURT_WIDTH, 340))
        pygame.draw.rect(self.screen, COLOR_LINES, pygame.Rect(COURT_MARGIN, GROUND_Y - 340, COURT_WIDTH, 340), 3)
        mid_x = COURT_MARGIN + COURT_WIDTH/2
        pygame.draw.line(self.screen, COLOR_LINES, (mid_x, GROUND_Y - 340), (mid_x, GROUND_Y), 2)
        pygame.draw.rect(self.screen, COLOR_NET, pygame.Rect(int(mid_x - NET_WIDTH/2), int(GROUND_Y - NET_HEIGHT), NET_WIDTH, NET_HEIGHT))

    def draw_players_and_shuttle(self):
        pygame.draw.rect(self.screen, self.human.color, self.human.rect())
        pygame.draw.rect(self.screen, self.ai.color, self.ai.rect())
        pygame.draw.rect(self.screen, COLOR_LINES, self.human.get_racket_rect())
        pygame.draw.rect(self.screen, COLOR_LINES, self.ai.get_racket_rect())
        pygame.draw.circle(self.screen, COLOR_SHUTTLE, (int(self.shuttle.x), int(self.shuttle.y)), self.shuttle.r)

    def run(self):
        while True:
            self.clock.tick(FPS)
            self.handle_events()
            self.update()
            self.draw_court()
            self.draw_players_and_shuttle()
            pygame.display.flip()

if __name__ == "__main__":
    game = BadmintonGame()
    game.run()
