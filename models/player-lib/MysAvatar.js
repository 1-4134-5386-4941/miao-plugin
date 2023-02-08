import lodash from 'lodash'
import { Common, Data } from '../../components/index.js'

const MysAvatar = {
  /**
   * 更新米游社角色信息
   * @param player
   * @param mys
   * @param force
   * @returns {Promise<boolean>}
   */
  async refreshMys (player, force = false) {
    let mys = player?.e?._mys
    if (!mys) {
      return false
    }
    // 不必要更新
    if ((new Date() * 1 - player._mys < 10 * 60 * 1000) && !force) {
      return false
    }
    let charData = await mys.getCharacter()
    if (!charData || !charData.avatars) {
      return false
    }
    MysAvatar.setMysCharData(player, charData)
  },

  /**
   * 根据已有Mys CharData更新player
   * @param player
   * @param charData
   */
  setMysCharData (player, charData) {
    let role = charData.role
    player.setBasicData({
      level: role.level,
      name: role.nickname
    })
    lodash.forEach(charData.avatars, (ds) => {
      let avatar = Data.getData(ds, 'id,level,cons:actived_constellation_num,fetter')
      avatar.elem = ds.element.toLowerCase()
      // 处理实装数据
      let costume = (ds?.costumes || [])[0]
      if (costume && costume.id) {
        avatar.costume = costume.id
      }
      avatar.weapon = Data.getData(ds.weapon, 'name,star:rarity,level,promote:promote_level,affix:affix_level')
      // 处理圣遗物数据
      let artis = {}
      lodash.forEach(ds.reliquaries, (re) => {
        const posIdx = { 生之花: 1, 死之羽: 2, 时之沙: 3, 空之杯: 4, 理之冠: 5 }
        if (re && re.name && posIdx[re.pos_name]) {
          artis[posIdx[re.pos_name]] = {
            name: re.name,
            level: re.level
          }
        }
      })
      avatar.artis = artis
      player.setAvatar(avatar, 'mys')
    })
    player._mys = new Date() * 1
    player.save()
  },

  /**
   * 获取当前角色需要更新天赋的角色ID
   * @param player
   * @param ids 角色列表，若传入则查询指定角色列表，不传入查询全部
   * @returns {*[]}
   */
  getNeedRefreshIds (player, ids) {
    let ret = []
    if (!ids) {
      ids = lodash.keys(player._avatars)
    } else if (!lodash.isArray(ids)) {
      ids = [ids]
    }
    lodash.forEach(ids, (id) => {
      let avatar = player.getAvatar(id)
      if (avatar.needRefreshTalent()) {
        ret.push(avatar.id)
      }
    })
    return ret
  },

  /**
   * 使用MysApi刷新指定角色的天赋信息
   * @param player
   * @param ids
   * @param force
   * @returns {Promise<boolean>}
   */
  async refreshTalent (player, ids, force) {
    let e = player?.e
    let mys = e?._mys
    if (!e || !mys) {
      return false
    }
    let needReqIds = MysAvatar.getNeedRefreshIds(player, ids)
    if (needReqIds.length > 0) {
      if (needReqIds.length > 8) {
        e && e.reply('正在获取角色信息，请稍候...')
      }
      let num = 10
      let ms = 100
      let skillRet = []
      let avatarArr = lodash.chunk(needReqIds, num)
      for (let val of avatarArr) {
        for (let id of val) {
          let avatar = player.getAvatar(id)
          skillRet.push(await avatar.refreshTalent(mys))
        }
        skillRet = await Promise.all(skillRet)
        skillRet = skillRet.filter(item => item.id)
        await Common.sleep(ms)
      }
    }
    player.save()
  }
}
export default MysAvatar
