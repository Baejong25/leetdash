 import java.util.*; 
class Solution {
    public int solution(String[][] clothes) {
        // ("headgear",  2)
        HashMap<String, Integer> map = new HashMap<>();  
        
        for (int i = 0; i < clothes.length; i++) {
            map.put(clothes[i][1], map.getOrDefault(clothes[i][1], 0)+1); 
            }
        
        // (다른 종류) 종류가 다른 값들의 곱 + (한 가지 종류) 모든 값의 합
        int answer = 1; 
        for (String k : map.keySet()) {
            answer *=  map.get(k) + 1; 
        }
    
        return answer - 1; 
    }
}