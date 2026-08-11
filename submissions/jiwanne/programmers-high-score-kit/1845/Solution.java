import java.util.*;

class Solution {
    public int solution(int[] nums) {
        int answer = 0;
        
        // 아 이거 값이랑 고유 인덱스를 비교해야하니
        // HashMap 으로 관리하면 되겠구나
        // 근데 배열이 하나만 들어와서
        // 배열안의 값들이 중복되는게 몇개 인지 확인을 먼저하고
        // 값을 비교하는게 좋아보임
        // 근데 nums의 길이가 최대 10000 까지 갈 수 있기 때문에
        // 이중 포문은 절대 사용 못함 10000 ^ 2 승으로 가면 터져버림
        // 아니 근데 이거 이중 포문 돌려서 값을 다 확인 하고 싶은데
        // 결국 중복되는 값들이 있으니 넣을 때 한번에 이거면 저거로 인덱스를 붙여서
        // 넣어버리고 싶음
        
        HashMap<Integer,List<Integer>> map = new HashMap<>();
        for (int x : nums) {
            if (!map.containsKey(x)) {
                map.put(x, new ArrayList<>());
              }
         map.get(x).add(x);
        }
        
        int l = nums.length / 2;
        
        if( l == map.keySet().size()) {
            return l;
        } else if(l > map.keySet().size()) {
            answer = map.keySet().size();
        } else if (l < map.keySet().size()) {
            answer = l;
        }
        return answer;
        
        // 더 나은 코드
        // 사실 키값까지 저장 안하고 map 안에 리스트로 저장하기보다
        // set 으로 있나 없냐만 저장해도 되는 문제
        // set = 중복을 허용하지 않는 상자
//         HashSet<Integer> set = new HashSet<>();
//         for(int x : nums) {
//             set.add(x);
//         }
//        int max = nums.length / 2;
//        return Math.min(max, set.size());
        
    }
}