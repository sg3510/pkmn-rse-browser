// Auto-generated; do not edit.
// Source: public/pokeemerald/data/battle_anim_scripts.s and src/battle_anim*.c
// Regenerate: npm run generate:battle-animations
import type { AnimationProgram, AnimationTemplate, AnimationAsset, AnimationBackground } from '../battle/animation/types.ts';

export const BATTLE_ANIMATION_PROGRAM: AnimationProgram = {
  "sourceHash": "97e928fee1ebfeaea0cb14b1c783579fd55ea2db13b5890b92c86aef87140d0d",
  "instructions": [
    {
      "op": "loadspritegfx",
      "args": [
        10135
      ],
      "line": 427
    },
    {
      "op": "monbg",
      "args": [
        1
      ],
      "line": 428
    },
    {
      "op": "setalpha",
      "args": [
        12,
        8
      ],
      "line": 429
    },
    {
      "op": "playsewithpan",
      "args": [
        134,
        63
      ],
      "line": 430
    },
    {
      "op": "createsprite",
      "args": [
        "gBasicHitSplatSpriteTemplate",
        0,
        2,
        0,
        0,
        1,
        2
      ],
      "line": 431
    },
    {
      "op": "createvisualtask",
      "args": [
        "AnimTask_ShakeMon",
        2,
        1,
        3,
        0,
        6,
        1
      ],
      "line": 432
    },
    {
      "op": "waitforvisualfinish",
      "args": [],
      "line": 433
    },
    {
      "op": "clearmonbg",
      "args": [
        1
      ],
      "line": 434
    },
    {
      "op": "blendoff",
      "args": [],
      "line": 435
    },
    {
      "op": "end",
      "args": [],
      "line": 436
    },
    {
      "op": "loadspritegfx",
      "args": [
        10135
      ],
      "line": 584
    },
    {
      "op": "monbg",
      "args": [
        1
      ],
      "line": 585
    },
    {
      "op": "setalpha",
      "args": [
        12,
        8
      ],
      "line": 586
    },
    {
      "op": "createsprite",
      "args": [
        "gHorizontalLungeSpriteTemplate",
        0,
        2,
        4,
        4
      ],
      "line": 587
    },
    {
      "op": "delay",
      "args": [
        6
      ],
      "line": 588
    },
    {
      "op": "createsprite",
      "args": [
        "gBasicHitSplatSpriteTemplate",
        0,
        2,
        0,
        0,
        1,
        2
      ],
      "line": 589
    },
    {
      "op": "createvisualtask",
      "args": [
        "AnimTask_ShakeMon",
        2,
        1,
        3,
        0,
        6,
        1
      ],
      "line": 590
    },
    {
      "op": "playsewithpan",
      "args": [
        139,
        63
      ],
      "line": 591
    },
    {
      "op": "waitforvisualfinish",
      "args": [],
      "line": 592
    },
    {
      "op": "clearmonbg",
      "args": [
        1
      ],
      "line": 593
    },
    {
      "op": "blendoff",
      "args": [],
      "line": 594
    },
    {
      "op": "end",
      "args": [],
      "line": 595
    },
    {
      "op": "loadspritegfx",
      "args": [
        10029
      ],
      "line": 920
    },
    {
      "op": "loopsewithpan",
      "args": [
        151,
        -64,
        5,
        2
      ],
      "line": 921
    },
    {
      "op": "createsprite",
      "args": [
        "gEmberSpriteTemplate",
        1,
        2,
        20,
        0,
        -16,
        24,
        20,
        1
      ],
      "line": 922
    },
    {
      "op": "delay",
      "args": [
        4
      ],
      "line": 923
    },
    {
      "op": "createsprite",
      "args": [
        "gEmberSpriteTemplate",
        1,
        2,
        20,
        0,
        0,
        24,
        20,
        1
      ],
      "line": 924
    },
    {
      "op": "delay",
      "args": [
        4
      ],
      "line": 925
    },
    {
      "op": "createsprite",
      "args": [
        "gEmberSpriteTemplate",
        1,
        2,
        20,
        0,
        16,
        24,
        20,
        1
      ],
      "line": 926
    },
    {
      "op": "delay",
      "args": [
        16
      ],
      "line": 927
    },
    {
      "op": "playsewithpan",
      "args": [
        144,
        63
      ],
      "line": 928
    },
    {
      "op": "call",
      "args": [
        "EmberFireHit"
      ],
      "line": 929
    },
    {
      "op": "call",
      "args": [
        "EmberFireHit"
      ],
      "line": 930
    },
    {
      "op": "call",
      "args": [
        "EmberFireHit"
      ],
      "line": 931
    },
    {
      "op": "end",
      "args": [],
      "line": 932
    },
    {
      "op": "createsprite",
      "args": [
        "gEmberFlareSpriteTemplate",
        1,
        2,
        -24,
        24,
        24,
        24,
        20,
        1,
        1
      ],
      "line": 935
    },
    {
      "op": "delay",
      "args": [
        4
      ],
      "line": 936
    },
    {
      "op": "return",
      "args": [],
      "line": 937
    },
    {
      "op": "loadspritegfx",
      "args": [
        10001
      ],
      "line": 1076
    },
    {
      "op": "loadspritegfx",
      "args": [
        10282
      ],
      "line": 1077
    },
    {
      "op": "loadspritegfx",
      "args": [
        10011
      ],
      "line": 1078
    },
    {
      "op": "createvisualtask",
      "args": [
        "AnimTask_BlendBattleAnimPal",
        10,
        1,
        0,
        0,
        6,
        0
      ],
      "line": 1079
    },
    {
      "op": "waitforvisualfinish",
      "args": [],
      "line": 1080
    },
    {
      "op": "delay",
      "args": [
        10
      ],
      "line": 1081
    },
    {
      "op": "createvisualtask",
      "args": [
        "AnimTask_ElectricBolt",
        5,
        24,
        -52,
        0
      ],
      "line": 1082
    },
    {
      "op": "playsewithpan",
      "args": [
        118,
        63
      ],
      "line": 1083
    },
    {
      "op": "delay",
      "args": [
        7
      ],
      "line": 1084
    },
    {
      "op": "createvisualtask",
      "args": [
        "AnimTask_ElectricBolt",
        5,
        -24,
        -52,
        0
      ],
      "line": 1085
    },
    {
      "op": "playsewithpan",
      "args": [
        118,
        63
      ],
      "line": 1086
    },
    {
      "op": "delay",
      "args": [
        7
      ],
      "line": 1087
    },
    {
      "op": "createvisualtask",
      "args": [
        "AnimTask_ElectricBolt",
        5,
        0,
        -60,
        1
      ],
      "line": 1088
    },
    {
      "op": "playsewithpan",
      "args": [
        118,
        63
      ],
      "line": 1089
    },
    {
      "op": "delay",
      "args": [
        9
      ],
      "line": 1090
    },
    {
      "op": "createvisualtask",
      "args": [
        "AnimTask_BlendBattleAnimPal",
        10,
        4,
        0,
        0,
        13,
        0
      ],
      "line": 1091
    },
    {
      "op": "waitforvisualfinish",
      "args": [],
      "line": 1092
    },
    {
      "op": "createvisualtask",
      "args": [
        "AnimTask_BlendBattleAnimPal",
        10,
        4,
        0,
        13,
        0,
        0
      ],
      "line": 1093
    },
    {
      "op": "waitforvisualfinish",
      "args": [],
      "line": 1094
    },
    {
      "op": "delay",
      "args": [
        20
      ],
      "line": 1095
    },
    {
      "op": "createsprite",
      "args": [
        "gThunderboltOrbSpriteTemplate",
        1,
        3,
        44,
        0,
        0,
        3
      ],
      "line": 1096
    },
    {
      "op": "createsprite",
      "args": [
        "gSparkElectricityFlashingSpriteTemplate",
        1,
        4,
        0,
        0,
        32,
        44,
        0,
        40,
        0,
        -32765
      ],
      "line": 1097
    },
    {
      "op": "createsprite",
      "args": [
        "gSparkElectricityFlashingSpriteTemplate",
        1,
        4,
        0,
        0,
        32,
        44,
        64,
        40,
        1,
        -32765
      ],
      "line": 1098
    },
    {
      "op": "createsprite",
      "args": [
        "gSparkElectricityFlashingSpriteTemplate",
        1,
        4,
        0,
        0,
        32,
        44,
        128,
        40,
        0,
        -32765
      ],
      "line": 1099
    },
    {
      "op": "createsprite",
      "args": [
        "gSparkElectricityFlashingSpriteTemplate",
        1,
        4,
        0,
        0,
        32,
        44,
        192,
        40,
        2,
        -32765
      ],
      "line": 1100
    },
    {
      "op": "createsprite",
      "args": [
        "gSparkElectricityFlashingSpriteTemplate",
        1,
        4,
        0,
        0,
        16,
        44,
        32,
        40,
        0,
        -32765
      ],
      "line": 1101
    },
    {
      "op": "createsprite",
      "args": [
        "gSparkElectricityFlashingSpriteTemplate",
        1,
        4,
        0,
        0,
        16,
        44,
        96,
        40,
        1,
        -32765
      ],
      "line": 1102
    },
    {
      "op": "createsprite",
      "args": [
        "gSparkElectricityFlashingSpriteTemplate",
        1,
        4,
        0,
        0,
        16,
        44,
        160,
        40,
        0,
        -32765
      ],
      "line": 1103
    },
    {
      "op": "createsprite",
      "args": [
        "gSparkElectricityFlashingSpriteTemplate",
        1,
        4,
        0,
        0,
        16,
        44,
        224,
        40,
        2,
        -32765
      ],
      "line": 1104
    },
    {
      "op": "playsewithpan",
      "args": [
        215,
        63
      ],
      "line": 1105
    },
    {
      "op": "delay",
      "args": [
        0
      ],
      "line": 1106
    },
    {
      "op": "createvisualtask",
      "args": [
        "AnimTask_BlendBattleAnimPal",
        10,
        1,
        0,
        2,
        2,
        0
      ],
      "line": 1107
    },
    {
      "op": "delay",
      "args": [
        6
      ],
      "line": 1108
    },
    {
      "op": "createvisualtask",
      "args": [
        "AnimTask_BlendBattleAnimPal",
        10,
        1,
        0,
        6,
        6,
        0
      ],
      "line": 1109
    },
    {
      "op": "delay",
      "args": [
        6
      ],
      "line": 1110
    },
    {
      "op": "createvisualtask",
      "args": [
        "AnimTask_BlendBattleAnimPal",
        10,
        1,
        0,
        2,
        2,
        0
      ],
      "line": 1111
    },
    {
      "op": "delay",
      "args": [
        6
      ],
      "line": 1112
    },
    {
      "op": "createvisualtask",
      "args": [
        "AnimTask_BlendBattleAnimPal",
        10,
        1,
        0,
        6,
        6,
        0
      ],
      "line": 1113
    },
    {
      "op": "waitforvisualfinish",
      "args": [],
      "line": 1114
    },
    {
      "op": "delay",
      "args": [
        20
      ],
      "line": 1115
    },
    {
      "op": "waitplaysewithpan",
      "args": [
        119,
        63,
        19
      ],
      "line": 1116
    },
    {
      "op": "call",
      "args": [
        "ElectricityEffect"
      ],
      "line": 1117
    },
    {
      "op": "waitforvisualfinish",
      "args": [],
      "line": 1118
    },
    {
      "op": "delay",
      "args": [
        20
      ],
      "line": 1119
    },
    {
      "op": "createvisualtask",
      "args": [
        "AnimTask_BlendBattleAnimPal",
        10,
        1,
        0,
        6,
        0,
        0
      ],
      "line": 1120
    },
    {
      "op": "waitforvisualfinish",
      "args": [],
      "line": 1121
    },
    {
      "op": "end",
      "args": [],
      "line": 1122
    },
    {
      "op": "loopsewithpan",
      "args": [
        167,
        -64,
        24,
        3
      ],
      "line": 1196
    },
    {
      "op": "createvisualtask",
      "args": [
        "AnimTask_TranslateMonEllipticalRespectSide",
        2,
        0,
        12,
        4,
        2,
        3
      ],
      "line": 1197
    },
    {
      "op": "waitforvisualfinish",
      "args": [],
      "line": 1198
    },
    {
      "op": "end",
      "args": [],
      "line": 1199
    },
    {
      "op": "loadspritegfx",
      "args": [
        10203
      ],
      "line": 4472
    },
    {
      "op": "monbg",
      "args": [
        2
      ],
      "line": 4473
    },
    {
      "op": "createvisualtask",
      "args": [
        "AnimTask_BlendBattleAnimPalExclude",
        5,
        0,
        0,
        0,
        16,
        0
      ],
      "line": 4474
    },
    {
      "op": "waitforvisualfinish",
      "args": [],
      "line": 4475
    },
    {
      "op": "createvisualtask",
      "args": [
        "AnimTask_SetAllNonAttackersInvisiblity",
        5,
        1
      ],
      "line": 4476
    },
    {
      "op": "waitforvisualfinish",
      "args": [],
      "line": 4477
    },
    {
      "op": "createsprite",
      "args": [
        "gThinRingShrinkingSpriteTemplate",
        0,
        40,
        0,
        0,
        0,
        0
      ],
      "line": 4478
    },
    {
      "op": "playsewithpan",
      "args": [
        184,
        -64
      ],
      "line": 4479
    },
    {
      "op": "delay",
      "args": [
        14
      ],
      "line": 4480
    },
    {
      "op": "createsprite",
      "args": [
        "gThinRingShrinkingSpriteTemplate",
        0,
        40,
        0,
        0,
        0,
        0
      ],
      "line": 4481
    },
    {
      "op": "playsewithpan",
      "args": [
        184,
        -64
      ],
      "line": 4482
    },
    {
      "op": "delay",
      "args": [
        14
      ],
      "line": 4483
    },
    {
      "op": "createsprite",
      "args": [
        "gThinRingShrinkingSpriteTemplate",
        0,
        40,
        0,
        0,
        0,
        0
      ],
      "line": 4484
    },
    {
      "op": "playsewithpan",
      "args": [
        184,
        -64
      ],
      "line": 4485
    },
    {
      "op": "waitforvisualfinish",
      "args": [],
      "line": 4486
    },
    {
      "op": "createvisualtask",
      "args": [
        "AnimTask_SetAllNonAttackersInvisiblity",
        5,
        0
      ],
      "line": 4487
    },
    {
      "op": "waitforvisualfinish",
      "args": [],
      "line": 4488
    },
    {
      "op": "createvisualtask",
      "args": [
        "AnimTask_BlendBattleAnimPalExclude",
        5,
        0,
        0,
        16,
        0,
        0
      ],
      "line": 4489
    },
    {
      "op": "waitforvisualfinish",
      "args": [],
      "line": 4490
    },
    {
      "op": "clearmonbg",
      "args": [
        2
      ],
      "line": 4491
    },
    {
      "op": "end",
      "args": [],
      "line": 4492
    },
    {
      "op": "monbg",
      "args": [
        3
      ],
      "line": 4728
    },
    {
      "op": "call",
      "args": [
        "SetPsychicBackground"
      ],
      "line": 4729
    },
    {
      "op": "setalpha",
      "args": [
        8,
        8
      ],
      "line": 4730
    },
    {
      "op": "createvisualtask",
      "args": [
        "AnimTask_ShakeMon2",
        2,
        0,
        1,
        0,
        10,
        1
      ],
      "line": 4731
    },
    {
      "op": "createvisualtask",
      "args": [
        "AnimTask_BlendColorCycle",
        2,
        2,
        0,
        2,
        0,
        8,
        767
      ],
      "line": 4732
    },
    {
      "op": "waitforvisualfinish",
      "args": [],
      "line": 4733
    },
    {
      "op": "loopsewithpan",
      "args": [
        184,
        63,
        10,
        3
      ],
      "line": 4734
    },
    {
      "op": "createvisualtask",
      "args": [
        "AnimTask_ShakeMon",
        2,
        1,
        5,
        0,
        15,
        1
      ],
      "line": 4735
    },
    {
      "op": "createvisualtask",
      "args": [
        "AnimTask_ScaleMonAndRestore",
        5,
        -6,
        -6,
        15,
        1,
        1
      ],
      "line": 4736
    },
    {
      "op": "waitforvisualfinish",
      "args": [],
      "line": 4737
    },
    {
      "op": "clearmonbg",
      "args": [
        3
      ],
      "line": 4738
    },
    {
      "op": "blendoff",
      "args": [],
      "line": 4739
    },
    {
      "op": "delay",
      "args": [
        1
      ],
      "line": 4740
    },
    {
      "op": "call",
      "args": [
        "UnsetPsychicBackground"
      ],
      "line": 4741
    },
    {
      "op": "end",
      "args": [],
      "line": 4742
    },
    {
      "op": "loadspritegfx",
      "args": [
        10137
      ],
      "line": 4913
    },
    {
      "op": "monbg",
      "args": [
        1
      ],
      "line": 4914
    },
    {
      "op": "setalpha",
      "args": [
        12,
        8
      ],
      "line": 4915
    },
    {
      "op": "playsewithpan",
      "args": [
        155,
        63
      ],
      "line": 4916
    },
    {
      "op": "createsprite",
      "args": [
        "gScratchSpriteTemplate",
        0,
        2,
        0,
        0,
        1,
        0
      ],
      "line": 4917
    },
    {
      "op": "createvisualtask",
      "args": [
        "AnimTask_ShakeMon",
        2,
        1,
        3,
        0,
        6,
        1
      ],
      "line": 4918
    },
    {
      "op": "waitforvisualfinish",
      "args": [],
      "line": 4919
    },
    {
      "op": "clearmonbg",
      "args": [
        1
      ],
      "line": 4920
    },
    {
      "op": "blendoff",
      "args": [],
      "line": 4921
    },
    {
      "op": "waitforvisualfinish",
      "args": [],
      "line": 4922
    },
    {
      "op": "end",
      "args": [],
      "line": 4923
    },
    {
      "op": "createsprite",
      "args": [
        "gRoarNoiseLineSpriteTemplate",
        0,
        2,
        24,
        -8,
        0
      ],
      "line": 4978
    },
    {
      "op": "createsprite",
      "args": [
        "gRoarNoiseLineSpriteTemplate",
        0,
        2,
        24,
        0,
        2
      ],
      "line": 4979
    },
    {
      "op": "createsprite",
      "args": [
        "gRoarNoiseLineSpriteTemplate",
        0,
        2,
        24,
        8,
        1
      ],
      "line": 4980
    },
    {
      "op": "delay",
      "args": [
        15
      ],
      "line": 4981
    },
    {
      "op": "createsprite",
      "args": [
        "gRoarNoiseLineSpriteTemplate",
        0,
        2,
        24,
        -8,
        0
      ],
      "line": 4982
    },
    {
      "op": "createsprite",
      "args": [
        "gRoarNoiseLineSpriteTemplate",
        0,
        2,
        24,
        0,
        2
      ],
      "line": 4983
    },
    {
      "op": "createsprite",
      "args": [
        "gRoarNoiseLineSpriteTemplate",
        0,
        2,
        24,
        8,
        1
      ],
      "line": 4984
    },
    {
      "op": "return",
      "args": [],
      "line": 4985
    },
    {
      "op": "loadspritegfx",
      "args": [
        10053
      ],
      "line": 4988
    },
    {
      "op": "createvisualtask",
      "args": [
        "SoundTask_PlayDoubleCry",
        2,
        0,
        255
      ],
      "line": 4989
    },
    {
      "op": "call",
      "args": [
        "RoarEffect"
      ],
      "line": 4990
    },
    {
      "op": "delay",
      "args": [
        10
      ],
      "line": 4991
    },
    {
      "op": "createvisualtask",
      "args": [
        "AnimTask_ShakeMon2",
        2,
        1,
        1,
        0,
        9,
        1
      ],
      "line": 4992
    },
    {
      "op": "createvisualtask",
      "args": [
        "AnimTask_ShakeMon2",
        2,
        3,
        1,
        0,
        9,
        1
      ],
      "line": 4993
    },
    {
      "op": "waitforvisualfinish",
      "args": [],
      "line": 4994
    },
    {
      "op": "createvisualtask",
      "args": [
        "SoundTask_WaitForCry",
        5
      ],
      "line": 4995
    },
    {
      "op": "waitforvisualfinish",
      "args": [],
      "line": 4996
    },
    {
      "op": "end",
      "args": [],
      "line": 4997
    },
    {
      "op": "loadspritegfx",
      "args": [
        10147
      ],
      "line": 5695
    },
    {
      "op": "loadspritegfx",
      "args": [
        10031
      ],
      "line": 5696
    },
    {
      "op": "loadspritegfx",
      "args": [
        10135
      ],
      "line": 5697
    },
    {
      "op": "monbg",
      "args": [
        3
      ],
      "line": 5698
    },
    {
      "op": "splitbgprio_foes",
      "args": [
        1
      ],
      "line": 5699
    },
    {
      "op": "setalpha",
      "args": [
        12,
        8
      ],
      "line": 5700
    },
    {
      "op": "createsprite",
      "args": [
        "gSimplePaletteBlendSpriteTemplate",
        0,
        2,
        1,
        1,
        0,
        4,
        13293
      ],
      "line": 5701
    },
    {
      "op": "waitforvisualfinish",
      "args": [],
      "line": 5702
    },
    {
      "op": "playsewithpan",
      "args": [
        180,
        63
      ],
      "line": 5703
    },
    {
      "op": "createsprite",
      "args": [
        "gBasicHitSplatSpriteTemplate",
        0,
        2,
        0,
        0,
        1,
        2
      ],
      "line": 5704
    },
    {
      "op": "delay",
      "args": [
        2
      ],
      "line": 5705
    },
    {
      "op": "createvisualtask",
      "args": [
        "AnimTask_ShakeMon",
        5,
        1,
        0,
        5,
        5,
        1
      ],
      "line": 5706
    },
    {
      "op": "waitforvisualfinish",
      "args": [],
      "line": 5707
    },
    {
      "op": "delay",
      "args": [
        3
      ],
      "line": 5708
    },
    {
      "op": "call",
      "args": [
        "AbsorbEffect"
      ],
      "line": 5709
    },
    {
      "op": "waitforvisualfinish",
      "args": [],
      "line": 5710
    },
    {
      "op": "delay",
      "args": [
        15
      ],
      "line": 5711
    },
    {
      "op": "call",
      "args": [
        "HealingEffect"
      ],
      "line": 5712
    },
    {
      "op": "waitforvisualfinish",
      "args": [],
      "line": 5713
    },
    {
      "op": "createsprite",
      "args": [
        "gSimplePaletteBlendSpriteTemplate",
        0,
        2,
        1,
        1,
        4,
        0,
        13293
      ],
      "line": 5714
    },
    {
      "op": "waitforvisualfinish",
      "args": [],
      "line": 5715
    },
    {
      "op": "clearmonbg",
      "args": [
        3
      ],
      "line": 5716
    },
    {
      "op": "blendoff",
      "args": [],
      "line": 5717
    },
    {
      "op": "end",
      "args": [],
      "line": 5718
    },
    {
      "op": "playsewithpan",
      "args": [
        142,
        63
      ],
      "line": 5721
    },
    {
      "op": "createsprite",
      "args": [
        "gAbsorptionOrbSpriteTemplate",
        0,
        3,
        0,
        5,
        8,
        26
      ],
      "line": 5722
    },
    {
      "op": "delay",
      "args": [
        4
      ],
      "line": 5723
    },
    {
      "op": "playsewithpan",
      "args": [
        142,
        63
      ],
      "line": 5724
    },
    {
      "op": "createsprite",
      "args": [
        "gAbsorptionOrbSpriteTemplate",
        0,
        3,
        10,
        -5,
        -8,
        26
      ],
      "line": 5725
    },
    {
      "op": "delay",
      "args": [
        4
      ],
      "line": 5726
    },
    {
      "op": "playsewithpan",
      "args": [
        142,
        63
      ],
      "line": 5727
    },
    {
      "op": "createsprite",
      "args": [
        "gAbsorptionOrbSpriteTemplate",
        0,
        3,
        -5,
        15,
        16,
        33
      ],
      "line": 5728
    },
    {
      "op": "delay",
      "args": [
        4
      ],
      "line": 5729
    },
    {
      "op": "playsewithpan",
      "args": [
        142,
        63
      ],
      "line": 5730
    },
    {
      "op": "createsprite",
      "args": [
        "gAbsorptionOrbSpriteTemplate",
        0,
        3,
        0,
        -15,
        -16,
        36
      ],
      "line": 5731
    },
    {
      "op": "delay",
      "args": [
        4
      ],
      "line": 5732
    },
    {
      "op": "playsewithpan",
      "args": [
        142,
        63
      ],
      "line": 5733
    },
    {
      "op": "createsprite",
      "args": [
        "gAbsorptionOrbSpriteTemplate",
        0,
        3,
        0,
        5,
        8,
        26
      ],
      "line": 5734
    },
    {
      "op": "delay",
      "args": [
        4
      ],
      "line": 5735
    },
    {
      "op": "playsewithpan",
      "args": [
        142,
        63
      ],
      "line": 5736
    },
    {
      "op": "createsprite",
      "args": [
        "gAbsorptionOrbSpriteTemplate",
        0,
        3,
        10,
        -5,
        -8,
        26
      ],
      "line": 5737
    },
    {
      "op": "delay",
      "args": [
        4
      ],
      "line": 5738
    },
    {
      "op": "playsewithpan",
      "args": [
        142,
        63
      ],
      "line": 5739
    },
    {
      "op": "createsprite",
      "args": [
        "gAbsorptionOrbSpriteTemplate",
        0,
        3,
        -10,
        20,
        20,
        39
      ],
      "line": 5740
    },
    {
      "op": "delay",
      "args": [
        4
      ],
      "line": 5741
    },
    {
      "op": "playsewithpan",
      "args": [
        142,
        63
      ],
      "line": 5742
    },
    {
      "op": "createsprite",
      "args": [
        "gAbsorptionOrbSpriteTemplate",
        0,
        3,
        5,
        -18,
        -20,
        35
      ],
      "line": 5743
    },
    {
      "op": "delay",
      "args": [
        4
      ],
      "line": 5744
    },
    {
      "op": "return",
      "args": [],
      "line": 5745
    },
    {
      "op": "loadspritegfx",
      "args": [
        10155
      ],
      "line": 6238
    },
    {
      "op": "loadspritegfx",
      "args": [
        10148
      ],
      "line": 6239
    },
    {
      "op": "monbg",
      "args": [
        3
      ],
      "line": 6240
    },
    {
      "op": "splitbgprio",
      "args": [
        1
      ],
      "line": 6241
    },
    {
      "op": "setalpha",
      "args": [
        12,
        8
      ],
      "line": 6242
    },
    {
      "op": "createsprite",
      "args": [
        "gWaterGunProjectileSpriteTemplate",
        0,
        2,
        20,
        0,
        0,
        0,
        40,
        -25
      ],
      "line": 6243
    },
    {
      "op": "playsewithpan",
      "args": [
        124,
        -64
      ],
      "line": 6244
    },
    {
      "op": "waitforvisualfinish",
      "args": [],
      "line": 6245
    },
    {
      "op": "createvisualtask",
      "args": [
        "AnimTask_ShakeMon2",
        5,
        1,
        1,
        0,
        8,
        1
      ],
      "line": 6246
    },
    {
      "op": "createsprite",
      "args": [
        "gWaterHitSplatSpriteTemplate",
        0,
        4,
        0,
        0,
        1,
        2
      ],
      "line": 6247
    },
    {
      "op": "createsprite",
      "args": [
        "gWaterGunDropletSpriteTemplate",
        0,
        2,
        0,
        -15,
        0,
        15,
        55
      ],
      "line": 6248
    },
    {
      "op": "playsewithpan",
      "args": [
        142,
        63
      ],
      "line": 6249
    },
    {
      "op": "delay",
      "args": [
        10
      ],
      "line": 6250
    },
    {
      "op": "createsprite",
      "args": [
        "gWaterGunDropletSpriteTemplate",
        0,
        2,
        15,
        -20,
        0,
        15,
        50
      ],
      "line": 6251
    },
    {
      "op": "playsewithpan",
      "args": [
        142,
        63
      ],
      "line": 6252
    },
    {
      "op": "delay",
      "args": [
        10
      ],
      "line": 6253
    },
    {
      "op": "createsprite",
      "args": [
        "gWaterGunDropletSpriteTemplate",
        0,
        2,
        -15,
        -10,
        0,
        10,
        45
      ],
      "line": 6254
    },
    {
      "op": "playsewithpan",
      "args": [
        142,
        63
      ],
      "line": 6255
    },
    {
      "op": "waitforvisualfinish",
      "args": [],
      "line": 6256
    },
    {
      "op": "clearmonbg",
      "args": [
        3
      ],
      "line": 6257
    },
    {
      "op": "blendoff",
      "args": [],
      "line": 6258
    },
    {
      "op": "end",
      "args": [],
      "line": 6259
    },
    {
      "op": "loadspritegfx",
      "args": [
        10176
      ],
      "line": 7351
    },
    {
      "op": "fadetobg",
      "args": [
        2
      ],
      "line": 7352
    },
    {
      "op": "waitbgfadein",
      "args": [],
      "line": 7353
    },
    {
      "op": "delay",
      "args": [
        15
      ],
      "line": 7354
    },
    {
      "op": "createsoundtask",
      "args": [
        "SoundTask_LoopSEAdjustPanning",
        168,
        -64,
        63,
        5,
        5,
        0,
        5
      ],
      "line": 7355
    },
    {
      "op": "createsprite",
      "args": [
        "gShadowBallSpriteTemplate",
        1,
        2,
        16,
        16,
        8
      ],
      "line": 7356
    },
    {
      "op": "waitforvisualfinish",
      "args": [],
      "line": 7357
    },
    {
      "op": "playsewithpan",
      "args": [
        159,
        63
      ],
      "line": 7358
    },
    {
      "op": "createvisualtask",
      "args": [
        "AnimTask_ShakeMon2",
        2,
        1,
        4,
        0,
        8,
        1
      ],
      "line": 7359
    },
    {
      "op": "waitforvisualfinish",
      "args": [],
      "line": 7360
    },
    {
      "op": "restorebg",
      "args": [],
      "line": 7361
    },
    {
      "op": "waitbgfadein",
      "args": [],
      "line": 7362
    },
    {
      "op": "end",
      "args": [],
      "line": 7363
    },
    {
      "op": "playsewithpan",
      "args": [
        179,
        -64
      ],
      "line": 10042
    },
    {
      "op": "createsprite",
      "args": [
        "gHealingBlueStarSpriteTemplate",
        0,
        2,
        0,
        -5,
        0,
        0
      ],
      "line": 10043
    },
    {
      "op": "delay",
      "args": [
        7
      ],
      "line": 10044
    },
    {
      "op": "createsprite",
      "args": [
        "gHealingBlueStarSpriteTemplate",
        0,
        2,
        -15,
        10,
        0,
        0
      ],
      "line": 10045
    },
    {
      "op": "delay",
      "args": [
        7
      ],
      "line": 10046
    },
    {
      "op": "createsprite",
      "args": [
        "gHealingBlueStarSpriteTemplate",
        0,
        2,
        -15,
        -15,
        0,
        0
      ],
      "line": 10047
    },
    {
      "op": "delay",
      "args": [
        7
      ],
      "line": 10048
    },
    {
      "op": "createsprite",
      "args": [
        "gHealingBlueStarSpriteTemplate",
        0,
        2,
        10,
        -5,
        0,
        0
      ],
      "line": 10049
    },
    {
      "op": "delay",
      "args": [
        7
      ],
      "line": 10050
    },
    {
      "op": "return",
      "args": [],
      "line": 10051
    },
    {
      "op": "playsewithpan",
      "args": [
        119,
        63
      ],
      "line": 10132
    },
    {
      "op": "createsprite",
      "args": [
        "gElectricitySpriteTemplate",
        1,
        2,
        5,
        0,
        5,
        0
      ],
      "line": 10133
    },
    {
      "op": "delay",
      "args": [
        2
      ],
      "line": 10134
    },
    {
      "op": "createsprite",
      "args": [
        "gElectricitySpriteTemplate",
        1,
        2,
        -5,
        10,
        5,
        1
      ],
      "line": 10135
    },
    {
      "op": "delay",
      "args": [
        2
      ],
      "line": 10136
    },
    {
      "op": "createsprite",
      "args": [
        "gElectricitySpriteTemplate",
        1,
        2,
        15,
        20,
        5,
        2
      ],
      "line": 10137
    },
    {
      "op": "delay",
      "args": [
        2
      ],
      "line": 10138
    },
    {
      "op": "createsprite",
      "args": [
        "gElectricitySpriteTemplate",
        1,
        2,
        -15,
        -10,
        5,
        0
      ],
      "line": 10139
    },
    {
      "op": "delay",
      "args": [
        2
      ],
      "line": 10140
    },
    {
      "op": "createsprite",
      "args": [
        "gElectricitySpriteTemplate",
        1,
        2,
        25,
        0,
        5,
        1
      ],
      "line": 10141
    },
    {
      "op": "delay",
      "args": [
        2
      ],
      "line": 10142
    },
    {
      "op": "createsprite",
      "args": [
        "gElectricitySpriteTemplate",
        1,
        2,
        -8,
        8,
        5,
        2
      ],
      "line": 10143
    },
    {
      "op": "delay",
      "args": [
        2
      ],
      "line": 10144
    },
    {
      "op": "createsprite",
      "args": [
        "gElectricitySpriteTemplate",
        1,
        2,
        2,
        -8,
        5,
        0
      ],
      "line": 10145
    },
    {
      "op": "delay",
      "args": [
        2
      ],
      "line": 10146
    },
    {
      "op": "createsprite",
      "args": [
        "gElectricitySpriteTemplate",
        1,
        2,
        -20,
        15,
        5,
        1
      ],
      "line": 10147
    },
    {
      "op": "return",
      "args": [],
      "line": 10148
    },
    {
      "op": "fadetobg",
      "args": [
        3
      ],
      "line": 10160
    },
    {
      "op": "waitbgfadeout",
      "args": [],
      "line": 10161
    },
    {
      "op": "createvisualtask",
      "args": [
        "AnimTask_SetPsychicBackground",
        5
      ],
      "line": 10162
    },
    {
      "op": "waitbgfadein",
      "args": [],
      "line": 10163
    },
    {
      "op": "return",
      "args": [],
      "line": 10164
    },
    {
      "op": "restorebg",
      "args": [],
      "line": 10167
    },
    {
      "op": "waitbgfadeout",
      "args": [],
      "line": 10168
    },
    {
      "op": "setarg",
      "args": [
        7,
        65535
      ],
      "line": 10169
    },
    {
      "op": "waitbgfadein",
      "args": [],
      "line": 10170
    },
    {
      "op": "return",
      "args": [],
      "line": 10171
    }
  ],
  "labels": {
    "gMovesWithQuietBGM": 0,
    "gBattleAnims_Moves": 0,
    "gBattleAnims_StatusConditions": 0,
    "gBattleAnims_General": 0,
    "gBattleAnims_Special": 0,
    "Move_NONE": 0,
    "Move_MIRROR_MOVE": 0,
    "Move_POUND": 0,
    "Move_TACKLE": 10,
    "Move_EMBER": 22,
    "EmberFireHit": 35,
    "Move_THUNDERBOLT": 38,
    "Move_TAIL_WHIP": 85,
    "Move_CALM_MIND": 89,
    "Move_PSYCHIC": 110,
    "Move_SCRATCH": 125,
    "RoarEffect": 136,
    "Move_GROWL": 144,
    "Move_ABSORB": 154,
    "AbsorbEffect": 178,
    "Move_WATER_GUN": 203,
    "Move_SHADOW_BALL": 225,
    "HealingEffect": 238,
    "ElectricityEffect": 248,
    "SetPsychicBackground": 265,
    "UnsetPsychicBackground": 270
  },
  "moveEntries": {
    "1": "Move_POUND",
    "10": "Move_SCRATCH",
    "33": "Move_TACKLE",
    "39": "Move_TAIL_WHIP",
    "45": "Move_GROWL",
    "52": "Move_EMBER",
    "55": "Move_WATER_GUN",
    "71": "Move_ABSORB",
    "85": "Move_THUNDERBOLT",
    "94": "Move_PSYCHIC",
    "247": "Move_SHADOW_BALL",
    "347": "Move_CALM_MIND"
  }
};

export const BATTLE_ANIMATION_TEMPLATES: Readonly<Record<string, AnimationTemplate>> = {
  "gHorizontalLungeSpriteTemplate": {
    "callback": "DoHorizontalLunge",
    "tag": 0,
    "width": 0,
    "height": 0,
    "blend": false,
    "affine": false,
    "frames": [
      [
        {
          "op": "END",
          "args": []
        }
      ]
    ],
    "affineFrames": [
      [
        {
          "op": "END",
          "args": []
        }
      ]
    ],
    "source": "src/battle_anim_mon_movement.c:30"
  },
  "gBasicHitSplatSpriteTemplate": {
    "callback": "AnimHitSplatBasic",
    "tag": 10135,
    "width": 32,
    "height": 32,
    "blend": true,
    "affine": true,
    "frames": [
      [
        {
          "op": "END",
          "args": []
        }
      ]
    ],
    "affineFrames": [
      [
        {
          "op": "FRAME",
          "args": [
            0,
            0,
            0,
            8
          ]
        },
        {
          "op": "END",
          "args": []
        }
      ],
      [
        {
          "op": "FRAME",
          "args": [
            216,
            216,
            0,
            0
          ]
        },
        {
          "op": "FRAME",
          "args": [
            0,
            0,
            0,
            8
          ]
        },
        {
          "op": "END",
          "args": []
        }
      ],
      [
        {
          "op": "FRAME",
          "args": [
            176,
            176,
            0,
            0
          ]
        },
        {
          "op": "FRAME",
          "args": [
            0,
            0,
            0,
            8
          ]
        },
        {
          "op": "END",
          "args": []
        }
      ],
      [
        {
          "op": "FRAME",
          "args": [
            128,
            128,
            0,
            0
          ]
        },
        {
          "op": "FRAME",
          "args": [
            0,
            0,
            0,
            8
          ]
        },
        {
          "op": "END",
          "args": []
        }
      ]
    ],
    "source": "src/battle_anim_normal.c:168"
  },
  "gRoarNoiseLineSpriteTemplate": {
    "callback": "AnimRoarNoiseLine",
    "tag": 10053,
    "width": 32,
    "height": 32,
    "blend": false,
    "affine": false,
    "frames": [
      [
        {
          "op": "FRAME",
          "args": [
            0,
            3
          ]
        },
        {
          "op": "FRAME",
          "args": [
            16,
            3
          ]
        },
        {
          "op": "JUMP",
          "args": [
            0
          ]
        }
      ],
      [
        {
          "op": "FRAME",
          "args": [
            32,
            3
          ]
        },
        {
          "op": "FRAME",
          "args": [
            48,
            3
          ]
        },
        {
          "op": "JUMP",
          "args": [
            0
          ]
        }
      ]
    ],
    "affineFrames": [
      [
        {
          "op": "END",
          "args": []
        }
      ]
    ],
    "source": "src/battle_anim_effects_3.c:949"
  },
  "gScratchSpriteTemplate": {
    "callback": "AnimSpriteOnMonPos",
    "tag": 10137,
    "width": 32,
    "height": 32,
    "blend": true,
    "affine": false,
    "frames": [
      [
        {
          "op": "FRAME",
          "args": [
            0,
            4
          ]
        },
        {
          "op": "FRAME",
          "args": [
            16,
            4
          ]
        },
        {
          "op": "FRAME",
          "args": [
            32,
            4
          ]
        },
        {
          "op": "FRAME",
          "args": [
            48,
            4
          ]
        },
        {
          "op": "FRAME",
          "args": [
            64,
            4
          ]
        },
        {
          "op": "END",
          "args": []
        }
      ]
    ],
    "affineFrames": [
      [
        {
          "op": "END",
          "args": []
        }
      ]
    ],
    "source": "src/battle_anim_effects_3.c:139"
  },
  "gEmberFlareSpriteTemplate": {
    "callback": "AnimEmberFlare",
    "tag": 10029,
    "width": 32,
    "height": 32,
    "blend": false,
    "affine": false,
    "frames": [
      [
        {
          "op": "FRAME",
          "args": [
            0,
            4
          ]
        },
        {
          "op": "FRAME",
          "args": [
            16,
            4
          ]
        },
        {
          "op": "FRAME",
          "args": [
            32,
            4
          ]
        },
        {
          "op": "FRAME",
          "args": [
            48,
            4
          ]
        },
        {
          "op": "FRAME",
          "args": [
            64,
            4
          ]
        },
        {
          "op": "JUMP",
          "args": [
            0
          ]
        }
      ]
    ],
    "affineFrames": [
      [
        {
          "op": "END",
          "args": []
        }
      ]
    ],
    "source": "src/battle_anim_fire.c:251"
  },
  "gEmberSpriteTemplate": {
    "callback": "TranslateAnimSpriteToTargetMonLocation",
    "tag": 10029,
    "width": 32,
    "height": 32,
    "blend": false,
    "affine": false,
    "frames": [
      [
        {
          "op": "END",
          "args": []
        }
      ]
    ],
    "affineFrames": [
      [
        {
          "op": "END",
          "args": []
        }
      ]
    ],
    "source": "src/battle_anim_fire.c:240"
  },
  "gWaterGunDropletSpriteTemplate": {
    "callback": "AnimWaterGunDroplet",
    "tag": 10155,
    "width": 16,
    "height": 16,
    "blend": true,
    "affine": true,
    "frames": [
      [
        {
          "op": "FRAME",
          "args": [
            4,
            1
          ]
        },
        {
          "op": "END",
          "args": []
        }
      ]
    ],
    "affineFrames": [
      [
        {
          "op": "FRAME",
          "args": [
            65520,
            16,
            0,
            6
          ]
        },
        {
          "op": "FRAME",
          "args": [
            16,
            65520,
            0,
            6
          ]
        },
        {
          "op": "JUMP",
          "args": [
            0
          ]
        }
      ]
    ],
    "source": "src/battle_anim_water.c:337"
  },
  "gWaterGunProjectileSpriteTemplate": {
    "callback": "AnimThrowProjectile",
    "tag": 10155,
    "width": 16,
    "height": 16,
    "blend": true,
    "affine": false,
    "frames": [
      [
        {
          "op": "FRAME",
          "args": [
            0,
            1
          ]
        },
        {
          "op": "END",
          "args": []
        }
      ]
    ],
    "affineFrames": [
      [
        {
          "op": "END",
          "args": []
        }
      ]
    ],
    "source": "src/battle_anim_water.c:326"
  },
  "gWaterHitSplatSpriteTemplate": {
    "callback": "AnimHitSplatBasic",
    "tag": 10148,
    "width": 32,
    "height": 32,
    "blend": true,
    "affine": true,
    "frames": [
      [
        {
          "op": "END",
          "args": []
        }
      ]
    ],
    "affineFrames": [
      [
        {
          "op": "FRAME",
          "args": [
            0,
            0,
            0,
            8
          ]
        },
        {
          "op": "END",
          "args": []
        }
      ],
      [
        {
          "op": "FRAME",
          "args": [
            216,
            216,
            0,
            0
          ]
        },
        {
          "op": "FRAME",
          "args": [
            0,
            0,
            0,
            8
          ]
        },
        {
          "op": "END",
          "args": []
        }
      ],
      [
        {
          "op": "FRAME",
          "args": [
            176,
            176,
            0,
            0
          ]
        },
        {
          "op": "FRAME",
          "args": [
            0,
            0,
            0,
            8
          ]
        },
        {
          "op": "END",
          "args": []
        }
      ],
      [
        {
          "op": "FRAME",
          "args": [
            128,
            128,
            0,
            0
          ]
        },
        {
          "op": "FRAME",
          "args": [
            0,
            0,
            0,
            8
          ]
        },
        {
          "op": "END",
          "args": []
        }
      ]
    ],
    "source": "src/battle_anim_normal.c:190"
  },
  "gAbsorptionOrbSpriteTemplate": {
    "callback": "AnimAbsorptionOrb",
    "tag": 10147,
    "width": 16,
    "height": 16,
    "blend": true,
    "affine": true,
    "frames": [
      [
        {
          "op": "FRAME",
          "args": [
            8,
            1
          ]
        },
        {
          "op": "END",
          "args": []
        }
      ]
    ],
    "affineFrames": [
      [
        {
          "op": "FRAME",
          "args": [
            -5,
            -5,
            0,
            1
          ]
        },
        {
          "op": "JUMP",
          "args": [
            0
          ]
        }
      ]
    ],
    "source": "src/battle_anim_effects_1.c:358"
  },
  "gHealingBlueStarSpriteTemplate": {
    "callback": "AnimSpriteOnMonPos",
    "tag": 10031,
    "width": 32,
    "height": 32,
    "blend": false,
    "affine": false,
    "frames": [
      [
        {
          "op": "FRAME",
          "args": [
            0,
            2
          ]
        },
        {
          "op": "FRAME",
          "args": [
            16,
            2
          ]
        },
        {
          "op": "FRAME",
          "args": [
            32,
            2
          ]
        },
        {
          "op": "FRAME",
          "args": [
            48,
            3
          ]
        },
        {
          "op": "FRAME",
          "args": [
            64,
            5
          ]
        },
        {
          "op": "FRAME",
          "args": [
            80,
            3
          ]
        },
        {
          "op": "FRAME",
          "args": [
            96,
            2
          ]
        },
        {
          "op": "FRAME",
          "args": [
            0,
            2
          ]
        },
        {
          "op": "END",
          "args": []
        }
      ]
    ],
    "affineFrames": [
      [
        {
          "op": "END",
          "args": []
        }
      ]
    ],
    "source": "src/battle_anim_effects_1.c:1842"
  },
  "gSimplePaletteBlendSpriteTemplate": {
    "callback": "AnimSimplePaletteBlend",
    "tag": 0,
    "width": 0,
    "height": 0,
    "blend": false,
    "affine": false,
    "frames": [
      [
        {
          "op": "END",
          "args": []
        }
      ]
    ],
    "affineFrames": [
      [
        {
          "op": "END",
          "args": []
        }
      ]
    ],
    "source": "src/battle_anim_normal.c:73"
  },
  "gThinRingShrinkingSpriteTemplate": {
    "callback": "AnimSpriteOnMonPos",
    "tag": 10203,
    "width": 64,
    "height": 64,
    "blend": true,
    "affine": true,
    "frames": [
      [
        {
          "op": "END",
          "args": []
        }
      ]
    ],
    "affineFrames": [
      [
        {
          "op": "FRAME",
          "args": [
            512,
            512,
            0,
            0
          ]
        },
        {
          "op": "FRAME",
          "args": [
            65520,
            65520,
            0,
            30
          ]
        },
        {
          "op": "END_ALT",
          "args": [
            1
          ]
        }
      ]
    ],
    "source": "src/battle_anim_effects_2.c:765"
  },
  "gElectricitySpriteTemplate": {
    "callback": "AnimElectricity",
    "tag": 10011,
    "width": 16,
    "height": 16,
    "blend": false,
    "affine": false,
    "extraFrames": [
      {
        "tileOffset": 4,
        "width": 16,
        "height": 16
      },
      {
        "tileOffset": 8,
        "width": 16,
        "height": 16
      }
    ],
    "frames": [
      [
        {
          "op": "END",
          "args": []
        }
      ]
    ],
    "affineFrames": [
      [
        {
          "op": "END",
          "args": []
        }
      ]
    ],
    "source": "src/battle_anim_electric.c:211"
  },
  "gSparkElectricityFlashingSpriteTemplate": {
    "callback": "AnimSparkElectricityFlashing",
    "tag": 10011,
    "width": 16,
    "height": 16,
    "blend": false,
    "affine": true,
    "extraFrames": [
      {
        "tileOffset": 4,
        "width": 16,
        "height": 16
      },
      {
        "tileOffset": 8,
        "width": 16,
        "height": 16
      }
    ],
    "frames": [
      [
        {
          "op": "END",
          "args": []
        }
      ]
    ],
    "affineFrames": [
      [
        {
          "op": "FRAME",
          "args": [
            0,
            0,
            20,
            1
          ]
        },
        {
          "op": "JUMP",
          "args": [
            0
          ]
        }
      ]
    ],
    "source": "src/battle_anim_electric.c:200"
  },
  "gThunderboltOrbSpriteTemplate": {
    "callback": "AnimThunderboltOrb",
    "tag": 10282,
    "width": 32,
    "height": 32,
    "blend": false,
    "affine": true,
    "frames": [
      [
        {
          "op": "FRAME",
          "args": [
            0,
            6
          ]
        },
        {
          "op": "FRAME",
          "args": [
            16,
            6
          ]
        },
        {
          "op": "FRAME",
          "args": [
            32,
            6
          ]
        },
        {
          "op": "JUMP",
          "args": [
            0
          ]
        }
      ]
    ],
    "affineFrames": [
      [
        {
          "op": "FRAME",
          "args": [
            232,
            232,
            0,
            0
          ]
        },
        {
          "op": "FRAME",
          "args": [
            65528,
            65528,
            0,
            10
          ]
        },
        {
          "op": "FRAME",
          "args": [
            8,
            8,
            0,
            10
          ]
        },
        {
          "op": "JUMP",
          "args": [
            1
          ]
        }
      ]
    ],
    "source": "src/battle_anim_electric.c:189"
  },
  "gShadowBallSpriteTemplate": {
    "callback": "AnimShadowBall",
    "tag": 10176,
    "width": 32,
    "height": 32,
    "blend": false,
    "affine": true,
    "frames": [
      [
        {
          "op": "END",
          "args": []
        }
      ]
    ],
    "affineFrames": [
      [
        {
          "op": "FRAME",
          "args": [
            0,
            0,
            10,
            1
          ]
        },
        {
          "op": "JUMP",
          "args": [
            0
          ]
        }
      ]
    ],
    "source": "src/battle_anim_ghost.c:90"
  },
  "gElectricBoltSegmentSpriteTemplate": {
    "callback": "AnimElectricBoltSegment",
    "tag": 10001,
    "width": 8,
    "height": 8,
    "blend": false,
    "affine": false,
    "extraFrames": [
      {
        "tileOffset": 0,
        "width": 8,
        "height": 16
      },
      {
        "tileOffset": 1,
        "width": 8,
        "height": 16
      },
      {
        "tileOffset": 2,
        "width": 8,
        "height": 16
      },
      {
        "tileOffset": 3,
        "width": 8,
        "height": 16
      },
      {
        "tileOffset": 8,
        "width": 16,
        "height": 16
      },
      {
        "tileOffset": 12,
        "width": 16,
        "height": 16
      },
      {
        "tileOffset": 16,
        "width": 16,
        "height": 16
      },
      {
        "tileOffset": 20,
        "width": 16,
        "height": 16
      }
    ],
    "frames": [
      [
        {
          "op": "END",
          "args": []
        }
      ]
    ],
    "affineFrames": [
      [
        {
          "op": "END",
          "args": []
        }
      ]
    ],
    "source": "src/battle_anim_electric.c:222"
  }
};

export const BATTLE_ANIMATION_ASSETS: Readonly<Record<number, AnimationAsset>> = {
  "10001": {
    "path": "/pokeemerald/graphics/battle_anims/sprites/spark_0.png",
    "parts": [
      "/pokeemerald/graphics/battle_anims/sprites/spark_0.png",
      "/pokeemerald/graphics/battle_anims/sprites/spark_1.png"
    ],
    "palette": [
      [
        164,
        148,
        139
      ],
      [
        255,
        139,
        0
      ],
      [
        255,
        156,
        8
      ],
      [
        255,
        172,
        24
      ],
      [
        255,
        197,
        41
      ],
      [
        255,
        213,
        57
      ],
      [
        255,
        230,
        74
      ],
      [
        255,
        255,
        90
      ],
      [
        255,
        255,
        255
      ],
      [
        255,
        74,
        106
      ],
      [
        255,
        115,
        148
      ],
      [
        255,
        164,
        197
      ],
      [
        255,
        205,
        238
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ]
    ],
    "byteSize": 768
  },
  "10011": {
    "path": "/pokeemerald/graphics/battle_anims/sprites/spark_2.png",
    "palette": [
      [
        164,
        148,
        139
      ],
      [
        255,
        139,
        0
      ],
      [
        255,
        156,
        8
      ],
      [
        255,
        172,
        24
      ],
      [
        255,
        197,
        41
      ],
      [
        255,
        213,
        57
      ],
      [
        255,
        230,
        74
      ],
      [
        255,
        255,
        90
      ],
      [
        255,
        255,
        255
      ],
      [
        255,
        74,
        106
      ],
      [
        255,
        115,
        148
      ],
      [
        255,
        164,
        197
      ],
      [
        255,
        205,
        238
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ]
    ],
    "byteSize": 384
  },
  "10029": {
    "path": "/pokeemerald/graphics/battle_anims/sprites/small_ember.png",
    "palette": [
      [
        0,
        0,
        0
      ],
      [
        255,
        255,
        255
      ],
      [
        255,
        255,
        205
      ],
      [
        255,
        255,
        164
      ],
      [
        255,
        255,
        123
      ],
      [
        255,
        255,
        82
      ],
      [
        255,
        255,
        41
      ],
      [
        255,
        197,
        32
      ],
      [
        255,
        148,
        24
      ],
      [
        255,
        98,
        16
      ],
      [
        255,
        49,
        8
      ],
      [
        255,
        0,
        0
      ],
      [
        156,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ]
    ],
    "byteSize": 2560
  },
  "10031": {
    "path": "/pokeemerald/graphics/battle_anims/sprites/blue_star.png",
    "palette": [
      [
        0,
        0,
        0
      ],
      [
        255,
        255,
        255
      ],
      [
        222,
        246,
        255
      ],
      [
        197,
        238,
        255
      ],
      [
        164,
        230,
        255
      ],
      [
        139,
        230,
        255
      ],
      [
        106,
        180,
        222
      ],
      [
        74,
        131,
        189
      ],
      [
        41,
        82,
        156
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ]
    ],
    "byteSize": 3584
  },
  "10053": {
    "path": "/pokeemerald/graphics/battle_anims/sprites/noise_line.png",
    "palette": [
      [
        0,
        0,
        0
      ],
      [
        255,
        255,
        255
      ],
      [
        255,
        255,
        205
      ],
      [
        255,
        255,
        164
      ],
      [
        255,
        255,
        123
      ],
      [
        255,
        255,
        82
      ],
      [
        255,
        255,
        41
      ],
      [
        255,
        197,
        32
      ],
      [
        255,
        148,
        24
      ],
      [
        255,
        98,
        16
      ],
      [
        255,
        49,
        8
      ],
      [
        255,
        0,
        0
      ],
      [
        156,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ]
    ],
    "byteSize": 2048
  },
  "10135": {
    "path": "/pokeemerald/graphics/battle_anims/sprites/impact.png",
    "palette": [
      [
        98,
        41,
        255
      ],
      [
        0,
        0,
        0
      ],
      [
        205,
        156,
        32
      ],
      [
        230,
        205,
        98
      ],
      [
        255,
        255,
        172
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ]
    ],
    "byteSize": 512
  },
  "10137": {
    "path": "/pokeemerald/graphics/battle_anims/sprites/scratch.png",
    "palette": [
      [
        98,
        41,
        255
      ],
      [
        0,
        0,
        0
      ],
      [
        205,
        156,
        32
      ],
      [
        230,
        205,
        98
      ],
      [
        255,
        255,
        172
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ]
    ],
    "byteSize": 2560
  },
  "10147": {
    "path": "/pokeemerald/graphics/battle_anims/sprites/orbs.png",
    "palette": [
      [
        164,
        148,
        139
      ],
      [
        255,
        139,
        0
      ],
      [
        255,
        156,
        8
      ],
      [
        255,
        172,
        24
      ],
      [
        255,
        197,
        41
      ],
      [
        255,
        213,
        57
      ],
      [
        255,
        230,
        74
      ],
      [
        255,
        255,
        90
      ],
      [
        255,
        255,
        255
      ],
      [
        255,
        74,
        106
      ],
      [
        255,
        115,
        148
      ],
      [
        255,
        164,
        197
      ],
      [
        255,
        205,
        238
      ],
      [
        82,
        172,
        0
      ],
      [
        172,
        222,
        98
      ],
      [
        0,
        0,
        0
      ]
    ],
    "byteSize": 384
  },
  "10148": {
    "path": "/pokeemerald/graphics/battle_anims/sprites/water_impact.png",
    "palette": [
      [
        106,
        148,
        139
      ],
      [
        98,
        90,
        255
      ],
      [
        115,
        106,
        255
      ],
      [
        139,
        131,
        255
      ],
      [
        164,
        156,
        255
      ],
      [
        180,
        180,
        255
      ],
      [
        205,
        205,
        255
      ],
      [
        230,
        230,
        255
      ],
      [
        255,
        255,
        255
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        180,
        180,
        255
      ],
      [
        205,
        205,
        255
      ],
      [
        230,
        230,
        255
      ]
    ],
    "byteSize": 512
  },
  "10155": {
    "path": "/pokeemerald/graphics/battle_anims/sprites/small_bubbles.png",
    "palette": [
      [
        106,
        148,
        139
      ],
      [
        98,
        90,
        255
      ],
      [
        115,
        106,
        255
      ],
      [
        139,
        131,
        255
      ],
      [
        164,
        156,
        255
      ],
      [
        180,
        180,
        255
      ],
      [
        205,
        205,
        255
      ],
      [
        230,
        230,
        255
      ],
      [
        255,
        255,
        255
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        180,
        180,
        255
      ],
      [
        205,
        205,
        255
      ],
      [
        230,
        230,
        255
      ]
    ],
    "byteSize": 320
  },
  "10176": {
    "path": "/pokeemerald/graphics/battle_anims/sprites/shadow_ball.png",
    "palette": [
      [
        164,
        148,
        139
      ],
      [
        255,
        255,
        255
      ],
      [
        65,
        0,
        65
      ],
      [
        139,
        0,
        139
      ],
      [
        213,
        0,
        213
      ],
      [
        255,
        0,
        255
      ],
      [
        222,
        82,
        222
      ],
      [
        238,
        164,
        238
      ],
      [
        24,
        16,
        82
      ],
      [
        24,
        16,
        98
      ],
      [
        24,
        24,
        115
      ],
      [
        24,
        32,
        139
      ],
      [
        24,
        32,
        156
      ],
      [
        24,
        41,
        172
      ],
      [
        32,
        49,
        197
      ],
      [
        0,
        0,
        0
      ]
    ],
    "byteSize": 512
  },
  "10203": {
    "path": "/pokeemerald/graphics/battle_anims/sprites/thin_ring.png",
    "palette": [
      [
        98,
        197,
        246
      ],
      [
        255,
        255,
        255
      ],
      [
        255,
        246,
        238
      ],
      [
        255,
        238,
        222
      ],
      [
        255,
        230,
        205
      ],
      [
        255,
        230,
        197
      ],
      [
        255,
        222,
        180
      ],
      [
        255,
        213,
        164
      ],
      [
        255,
        213,
        156
      ],
      [
        164,
        82,
        49
      ],
      [
        131,
        41,
        24
      ],
      [
        106,
        8,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ]
    ],
    "byteSize": 2048
  },
  "10282": {
    "path": "/pokeemerald/graphics/battle_anims/sprites/shock_3.png",
    "palette": [
      [
        0,
        0,
        0
      ],
      [
        255,
        255,
        255
      ],
      [
        255,
        255,
        148
      ],
      [
        255,
        255,
        41
      ],
      [
        255,
        197,
        32
      ],
      [
        255,
        148,
        24
      ],
      [
        255,
        98,
        16
      ],
      [
        255,
        49,
        8
      ],
      [
        57,
        49,
        255
      ],
      [
        180,
        255,
        255
      ],
      [
        106,
        255,
        255
      ],
      [
        57,
        238,
        180
      ],
      [
        8,
        230,
        106
      ],
      [
        8,
        115,
        90
      ],
      [
        8,
        8,
        74
      ],
      [
        0,
        0,
        0
      ]
    ],
    "byteSize": 1536
  }
};

export const BATTLE_ANIMATION_BACKGROUNDS: Readonly<Record<number, AnimationBackground>> = {
  "2": {
    "path": "/pokeemerald/graphics/battle_anims/backgrounds/ghost.png",
    "tilemap": "/pokeemerald/graphics/battle_anims/backgrounds/ghost.bin",
    "palette": [
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        106,
        156,
        255
      ],
      [
        123,
        139,
        222
      ],
      [
        148,
        123,
        189
      ],
      [
        164,
        106,
        156
      ],
      [
        189,
        98,
        123
      ],
      [
        205,
        82,
        90
      ],
      [
        230,
        65,
        57
      ],
      [
        255,
        57,
        32
      ]
    ],
    "cycleColors": 0
  },
  "3": {
    "path": "/pokeemerald/graphics/battle_anims/backgrounds/psychic.png",
    "tilemap": "/pokeemerald/graphics/battle_anims/backgrounds/psychic.bin",
    "palette": [
      [
        0,
        0,
        0
      ],
      [
        255,
        0,
        0
      ],
      [
        164,
        0,
        0
      ],
      [
        82,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        41,
        0,
        57
      ],
      [
        82,
        0,
        115
      ],
      [
        123,
        0,
        172
      ],
      [
        148,
        0,
        131
      ],
      [
        172,
        0,
        98
      ],
      [
        197,
        0,
        65
      ],
      [
        222,
        0,
        32
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ]
    ],
    "cycleColors": 11
  }
};

export const BATTLE_ANIMATION_SINE: readonly number[] = [0,6,12,18,25,31,37,43,49,56,62,68,74,80,86,92,97,103,109,115,120,126,131,136,142,147,152,157,162,167,171,176,181,185,189,193,197,201,205,209,212,216,219,222,225,228,231,234,236,238,241,243,244,246,248,249,251,252,253,254,254,255,255,255,256,255,255,255,254,254,253,252,251,249,248,246,244,243,241,238,236,234,231,228,225,222,219,216,212,209,205,201,197,193,189,185,181,176,171,167,162,157,152,147,142,136,131,126,120,115,109,103,97,92,86,80,74,68,62,56,49,43,37,31,25,18,12,6,0,-6,-12,-18,-25,-31,-37,-43,-49,-56,-62,-68,-74,-80,-86,-92,-97,-103,-109,-115,-120,-126,-131,-136,-142,-147,-152,-157,-162,-167,-171,-176,-181,-185,-189,-193,-197,-201,-205,-209,-212,-216,-219,-222,-225,-228,-231,-234,-236,-238,-241,-243,-244,-246,-248,-249,-251,-252,-253,-254,-254,-255,-255,-255,-256,-255,-255,-255,-254,-254,-253,-252,-251,-249,-248,-246,-244,-243,-241,-238,-236,-234,-231,-228,-225,-222,-219,-216,-212,-209,-205,-201,-197,-193,-189,-185,-181,-176,-171,-167,-162,-157,-152,-147,-142,-136,-131,-126,-120,-115,-109,-103,-97,-92,-86,-80,-74,-68,-62,-56,-49,-43,-37,-31,-25,-18,-12,-6];
