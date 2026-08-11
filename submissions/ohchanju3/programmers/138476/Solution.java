import java.util.*;
/*
경화가 한 상자에 담으려는 귤의 개수 k와 귤의 크기를 담은 배열 tangerine이 매개변수로 주어집니다. 경화가 귤 k개를 고를 때 크기가 서로 다른 종류의 수의 최솟값을 return 하도록 solution 함수를 작성해주세요.
*/

class Solution {
    public int solution(int k, int[] tangerine) {
        HashMap<Integer, Integer> map = new HashMap<>();
        
        for(int i=0; i<tangerine.length; i++){
            map.put(tangerine[i], map.getOrDefault(tangerine[i], 0) + 1);}
            
            List<Integer> cntList = new ArrayList<>(map.values());
            
            Collections.sort(cntList, Collections.reverseOrder());
        int cnt = 0;
            int sum = 0;
            for(int i = 0; i<cntList.size(); i++){
                sum += cntList.get(i);
                cnt++;
                
                if(sum >= k) break;
            }
            return cnt;
   
        }
}