import java.util.HashMap;

class Solution {
    public int solution(String[][] clothes) {
        HashMap<String , Integer> map = new HashMap<>();
        for(int i = 0; i < clothes.length; i++) {
            String s = clothes[i][1];
            map.put(s , map.getOrDefault(s , 0) + 1);
        }
        int answer = 1;
        for(int count : map.values()) {
            answer *= (count + 1);
        }
        return answer - 1;
    }
}